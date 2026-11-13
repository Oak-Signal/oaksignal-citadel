// Incident reporting. Members report damaged or missing equipment they hold; the item is
// flagged and the people who manage maintenance are notified. Maintenance staff review the
// reports and move them through open, in progress and resolved.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireUnitMember, requireUnitPermission } from "./lib/authz";
import { conflict, notFound, validation } from "./lib/errors";
import { incidentStatusValidator, MAX_NOTE_LENGTH, requireText } from "./lib/validators";
import { notifyByPermission } from "./notifications";

const MAX_ROWS = 200;

// Unresolved reports first; pass `includeResolved` to also see closed ones.
export const list = query({
  args: { unitId: v.id("units"), includeResolved: v.optional(v.boolean()) },
  handler: async (ctx, { unitId, includeResolved }) => {
    await requireUnitPermission(ctx, unitId, "maintenance.manage");
    const statuses: Doc<"incidents">["status"][] = includeResolved
      ? ["open", "in_progress", "resolved"]
      : ["open", "in_progress"];
    const incidents: Doc<"incidents">[] = [];
    for (const status of statuses) {
      incidents.push(
        ...(await ctx.db
          .query("incidents")
          .withIndex("by_unit_and_status", (q) => q.eq("unitId", unitId).eq("status", status))
          .order("desc")
          .take(MAX_ROWS)),
      );
    }
    incidents.sort((a, b) => b.occurredAt - a.occurredAt);
    return await Promise.all(
      incidents.map(async (incident) => {
        const item = await ctx.db.get(incident.itemId);
        const reporter = await ctx.db.get(incident.reportedBy);
        return {
          incidentId: incident._id,
          itemId: incident.itemId,
          itemName: item?.name ?? "Unknown item",
          assetTag: item?.assetTag,
          type: incident.type,
          description: incident.description,
          status: incident.status,
          reportedByName: reporter?.displayName ?? "Unknown member",
          occurredAt: incident.occurredAt,
        };
      }),
    );
  },
});

const NEXT_STATUS: Record<Doc<"incidents">["status"], Doc<"incidents">["status"][]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: [],
};

// Updates the review status only. Changing the item's own status or condition is still done
// from the item, so a resolution never silently returns equipment to circulation.
export const setStatus = mutation({
  args: { incidentId: v.id("incidents"), status: incidentStatusValidator },
  handler: async (ctx, { incidentId, status }) => {
    const incident = await ctx.db.get(incidentId);
    if (!incident) throw notFound("Incident");
    const { user } = await requireUnitPermission(ctx, incident.unitId, "maintenance.manage");
    if (!NEXT_STATUS[incident.status].includes(status)) {
      throw conflict("That change is not allowed for this incident.");
    }
    await ctx.db.patch(incidentId, {
      status,
      resolvedBy: status === "resolved" ? user._id : undefined,
    });
    await appendAudit(ctx, {
      unitId: incident.unitId,
      actorId: user._id,
      action: "incident.status",
      entityType: "incidents",
      entityId: incidentId,
      before: { status: incident.status },
      after: { status },
    });
  },
});

export const report = mutation({
  args: {
    unitId: v.id("units"),
    itemId: v.id("items"),
    type: v.union(v.literal("damage"), v.literal("loss")),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await requireUnitMember(ctx, args.unitId);
    const description = requireText(args.description, "Description", MAX_NOTE_LENGTH);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.unitId !== args.unitId) throw notFound("Item");

    // Members can only report on equipment currently issued to them.
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_unit_and_member", (q) =>
        q.eq("unitId", args.unitId).eq("memberId", membership._id),
      )
      .filter((q) => q.neq(q.field("status"), "closed"))
      .take(200);
    if (!assignments.some((assignment) => assignment.itemId === args.itemId)) {
      throw validation("You can only report equipment that is issued to you.");
    }

    const now = Date.now();
    const incidentId = await ctx.db.insert("incidents", {
      unitId: args.unitId,
      itemId: item._id,
      type: args.type,
      reportedBy: user._id,
      description,
      status: "open",
      occurredAt: now,
    });

    // A serialized asset is one physical thing, so its status can be flagged directly. A bulk
    // item's status covers every unit, so it stays as is and the open incident is the flag.
    const nextStatus = args.type === "damage" ? "damaged" : "missing";
    if (item.trackingMode === "serialized") {
      await ctx.db.patch(item._id, { status: nextStatus, updatedBy: user._id, updatedAt: now });
    }
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "incident.report",
      entityType: "items",
      entityId: item._id,
      before: { status: item.status },
      after: {
        status: item.trackingMode === "serialized" ? nextStatus : item.status,
        incidentId,
        type: args.type,
      },
      reason: description,
    });
    await notifyByPermission(ctx, {
      unitId: args.unitId,
      permission: "maintenance.manage",
      type: "incident.reported",
      title: args.type === "damage" ? "Damaged equipment reported" : "Missing equipment reported",
      body: `${user.displayName} reported ${item.name} as ${args.type === "damage" ? "damaged" : "missing"}.`,
      link: `/operator/inventory/${item._id}`,
    });
    return { incidentId };
  },
});
