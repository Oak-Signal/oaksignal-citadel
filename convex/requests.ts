// Equipment requests: members submit, approvers decide per line, and issuers fulfil by creating
// an issue transaction. Restricted items need `items.restricted.approve` (Officer Staff or
// Logistics Officer by default) in addition to `requests.approve` (FR-042).
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireUnitMember, requireUnitPermission } from "./lib/authz";
import { conflict, forbidden, notFound, validation } from "./lib/errors";
import { assertRequestKey, findTransactionByRequestKey } from "./lib/mutations";
import { MAX_NOTE_LENGTH, requestStatusValidator } from "./lib/validators";
import { notifyByPermission, notifyUser } from "./notifications";
import { issueToMember } from "./transactions";

const MAX_LINES = 50;
const MAX_QUANTITY = 1_000_000;
const MAX_ROWS = 100;

type LineStatus = Doc<"requestLines">["status"];
type RequestStatus = Doc<"requests">["status"];

function cleanNote(note: string | undefined, field: string) {
  const trimmed = note?.trim() || undefined;
  if (trimmed && trimmed.length > MAX_NOTE_LENGTH) {
    throw validation(`${field} must be at most ${MAX_NOTE_LENGTH} characters.`);
  }
  return trimmed;
}

// The request status follows from its lines, so it can never disagree with them.
export function deriveRequestStatus(
  lines: Pick<Doc<"requestLines">, "status" | "fulfilledQuantity">[],
): RequestStatus {
  const pending = lines.some((line) => line.status === "pending");
  const active = lines.filter((line) => line.status !== "rejected");
  if (!pending && active.length === 0) return "rejected";
  if (!pending && active.every((line) => line.status === "fulfilled")) return "fulfilled";
  if (lines.some((line) => line.fulfilledQuantity > 0)) return "partially_fulfilled";
  return pending ? "submitted" : "approved";
}

export const submit = mutation({
  args: {
    unitId: v.id("units"),
    lines: v.array(v.object({ itemId: v.id("items"), quantity: v.number() })),
    note: v.optional(v.string()),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, membership } = await requireUnitPermission(ctx, args.unitId, "requests.submit");
    const requestKey = assertRequestKey(args.requestKey);
    const replay = await ctx.db
      .query("requests")
      .withIndex("by_unit_and_requestKey", (q) =>
        q.eq("unitId", args.unitId).eq("requestKey", requestKey),
      )
      .unique();
    if (replay) return { requestId: replay._id, replayed: true };

    if (args.lines.length < 1) throw validation("Add at least one item.");
    if (args.lines.length > MAX_LINES) {
      throw validation(`A request can have at most ${MAX_LINES} items.`);
    }
    if (new Set(args.lines.map((line) => line.itemId)).size !== args.lines.length) {
      throw validation("Each item can appear only once. Combine the quantities instead.");
    }
    const note = cleanNote(args.note, "Note");

    let restricted = false;
    const itemNames: string[] = [];
    for (const line of args.lines) {
      const item = await ctx.db.get(line.itemId);
      if (!item || item.unitId !== args.unitId || item.archived) throw notFound("Item");
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
        throw validation(`Quantity for ${item.name} must be a whole number of 1 or more.`);
      }
      if (item.trackingMode === "serialized" && line.quantity !== 1) {
        throw validation(`${item.name} is a serialized asset and is requested one at a time.`);
      }
      restricted ||= item.restricted;
      itemNames.push(item.name);
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("requests", {
      unitId: args.unitId,
      requesterId: membership._id,
      status: "submitted",
      requiresRestrictedApproval: restricted,
      note,
      requestKey,
      createdAt: now,
      updatedAt: now,
    });
    for (const line of args.lines) {
      await ctx.db.insert("requestLines", {
        unitId: args.unitId,
        requestId,
        itemId: line.itemId,
        quantity: line.quantity,
        status: "pending",
        fulfilledQuantity: 0,
      });
    }
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "request.submit",
      entityType: "requests",
      entityId: requestId,
      after: { lines: args.lines.length, requiresRestrictedApproval: restricted },
      reason: note,
    });
    await notifyByPermission(ctx, {
      unitId: args.unitId,
      permission: "requests.approve",
      type: "request.submitted",
      title: restricted ? "Request needs restricted-item approval" : "New equipment request",
      body: `${user.displayName} requested ${itemNames.join(", ")}.`,
      link: "/operator/requests",
    });
    return { requestId, replayed: false };
  },
});

// Only the requester can cancel, and only while nothing has been issued against the request.
export const cancel = mutation({
  args: { unitId: v.id("units"), requestId: v.id("requests") },
  handler: async (ctx, { unitId, requestId }) => {
    const { user, membership } = await requireUnitMember(ctx, unitId);
    const request = await ctx.db.get(requestId);
    if (!request || request.unitId !== unitId || request.requesterId !== membership._id) {
      throw notFound("Request");
    }
    if (request.status !== "submitted" && request.status !== "approved") {
      throw conflict("This request can no longer be cancelled.");
    }
    const lines = await ctx.db
      .query("requestLines")
      .withIndex("by_request", (q) => q.eq("requestId", requestId))
      .take(MAX_LINES);
    if (lines.some((line) => line.fulfilledQuantity > 0)) {
      throw conflict("Part of this request has already been issued, so it cannot be cancelled.");
    }
    await ctx.db.patch(requestId, { status: "cancelled", updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId,
      actorId: user._id,
      action: "request.cancel",
      entityType: "requests",
      entityId: requestId,
      before: { status: request.status },
      after: { status: "cancelled" },
    });
  },
});

export const decide = mutation({
  args: {
    unitId: v.id("units"),
    requestId: v.id("requests"),
    decisions: v.array(
      v.object({
        lineId: v.id("requestLines"),
        decision: v.union(v.literal("approve"), v.literal("reject")),
      }),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, membership, permissions } = await requireUnitPermission(
      ctx,
      args.unitId,
      "requests.approve",
    );
    const request = await ctx.db.get(args.requestId);
    if (!request || request.unitId !== args.unitId) throw notFound("Request");
    if (request.requesterId === membership._id) {
      throw forbidden();
    }
    if (request.status !== "submitted") throw conflict("This request has already been decided.");
    if (args.decisions.length < 1) throw validation("Decide at least one item.");
    if (new Set(args.decisions.map((d) => d.lineId)).size !== args.decisions.length) {
      throw validation("Each item can appear only once.");
    }
    const note = cleanNote(args.note, "Decision note");

    const lines = await ctx.db
      .query("requestLines")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .take(MAX_LINES);
    const updated = new Map<Id<"requestLines">, LineStatus>();
    for (const { lineId, decision } of args.decisions) {
      const line = lines.find((candidate) => candidate._id === lineId);
      if (!line) throw notFound("Request item");
      if (line.status !== "pending") throw conflict("That item has already been decided.");
      if (decision === "approve") {
        const item = await ctx.db.get(line.itemId);
        if (!item || item.unitId !== args.unitId) throw notFound("Item");
        if (item.restricted && !permissions.has("items.restricted.approve")) {
          throw forbidden();
        }
      }
      updated.set(lineId, decision === "approve" ? "approved" : "rejected");
    }

    for (const [lineId, status] of updated) await ctx.db.patch(lineId, { status });
    const nextLines = lines.map((line) => ({
      ...line,
      status: updated.get(line._id) ?? line.status,
    }));
    const status = deriveRequestStatus(nextLines);
    await ctx.db.patch(args.requestId, {
      status,
      decidedBy: user._id,
      decisionNote: note,
      updatedAt: Date.now(),
    });
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "request.decide",
      entityType: "requests",
      entityId: args.requestId,
      before: { status: request.status },
      after: {
        status,
        decisions: args.decisions.map((d) => ({ lineId: d.lineId, decision: d.decision })),
      },
      reason: note,
    });

    const requester = await ctx.db.get(request.requesterId);
    if (requester) {
      const approved = args.decisions.filter((d) => d.decision === "approve").length;
      const rejected = args.decisions.length - approved;
      await notifyUser(ctx, {
        unitId: args.unitId,
        userId: requester.userId,
        type: "request.decided",
        title: approved > 0 ? "Your request was approved" : "Your request was rejected",
        body: `${approved} item(s) approved, ${rejected} rejected.${note ? ` Note: ${note}` : ""}`,
        link: "/self-service/requests",
      });
    }
    return { status };
  },
});

export const fulfil = mutation({
  args: {
    unitId: v.id("units"),
    requestId: v.id("requests"),
    // Quantities may be below what was approved: the rest stays open for a later fulfilment.
    lines: v.array(v.object({ lineId: v.id("requestLines"), quantity: v.number() })),
    expectedReturnAt: v.optional(v.number()),
    note: v.optional(v.string()),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireUnitPermission(ctx, args.unitId, "issuance.perform");
    const requestKey = assertRequestKey(args.requestKey);
    const replay = await findTransactionByRequestKey(ctx, args.unitId, requestKey);
    if (replay) return { transactionId: replay._id, replayed: true };

    const request = await ctx.db.get(args.requestId);
    if (!request || request.unitId !== args.unitId) throw notFound("Request");
    if (request.status !== "approved" && request.status !== "partially_fulfilled") {
      throw conflict("Only approved requests can be fulfilled.");
    }
    if (args.lines.length < 1) throw validation("Choose at least one item to issue.");
    if (new Set(args.lines.map((l) => l.lineId)).size !== args.lines.length) {
      throw validation("Each item can appear only once.");
    }

    const requestLines = await ctx.db
      .query("requestLines")
      .withIndex("by_request", (q) => q.eq("requestId", args.requestId))
      .take(MAX_LINES);
    const issueLines: { itemId: Id<"items">; quantity: number }[] = [];
    for (const { lineId, quantity } of args.lines) {
      const line = requestLines.find((candidate) => candidate._id === lineId);
      if (!line) throw notFound("Request item");
      if (line.status !== "approved") throw conflict("Only approved items can be issued.");
      const remaining = line.quantity - line.fulfilledQuantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > remaining) {
        throw validation(`Issue between 1 and ${remaining} of this item.`);
      }
      issueLines.push({ itemId: line.itemId, quantity });
    }

    const result = await issueToMember(ctx, {
      unitId: args.unitId,
      memberId: request.requesterId,
      lines: issueLines,
      expectedReturnAt: args.expectedReturnAt,
      note: args.note,
      requestKey,
      user: access.user,
      unit: access.unit,
      requestId: args.requestId,
      authorizedBy: request.decidedBy,
    });

    const issued = new Map(args.lines.map((l) => [l.lineId, l.quantity]));
    const nextLines = requestLines.map((line) => {
      const quantity = issued.get(line._id);
      if (quantity === undefined) return line;
      const fulfilledQuantity = line.fulfilledQuantity + quantity;
      return {
        ...line,
        fulfilledQuantity,
        status: fulfilledQuantity >= line.quantity ? ("fulfilled" as const) : line.status,
      };
    });
    for (const line of nextLines) {
      const original = requestLines.find((candidate) => candidate._id === line._id);
      if (original && original.fulfilledQuantity !== line.fulfilledQuantity) {
        await ctx.db.patch(line._id, {
          fulfilledQuantity: line.fulfilledQuantity,
          status: line.status,
        });
      }
    }
    const status = deriveRequestStatus(nextLines);
    await ctx.db.patch(args.requestId, { status, updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: access.user._id,
      action: "request.fulfil",
      entityType: "requests",
      entityId: args.requestId,
      before: { status: request.status },
      after: { status, transactionId: result.transactionId },
    });

    const requester = await ctx.db.get(request.requesterId);
    if (requester) {
      await notifyUser(ctx, {
        unitId: args.unitId,
        userId: requester.userId,
        type: "request.fulfilled",
        title:
          status === "fulfilled" ? "Your request was fulfilled" : "Part of your request was issued",
        body: "Check My equipment for what was issued to you.",
        link: "/self-service/equipment",
      });
    }
    return result;
  },
});

type RequestRow = {
  requestId: Id<"requests">;
  status: RequestStatus;
  requesterId: Id<"memberships">;
  requesterName: string;
  requiresRestrictedApproval: boolean;
  note?: string;
  decisionNote?: string;
  createdAt: number;
  lines: {
    lineId: Id<"requestLines">;
    itemId: Id<"items">;
    itemName: string;
    restricted: boolean;
    quantity: number;
    fulfilledQuantity: number;
    quantityAvailable: number;
    status: LineStatus;
  }[];
};

export async function toRow(ctx: QueryCtx, request: Doc<"requests">): Promise<RequestRow> {
  const member = await ctx.db.get(request.requesterId);
  const user = member ? await ctx.db.get(member.userId) : null;
  const lines = await ctx.db
    .query("requestLines")
    .withIndex("by_request", (q) => q.eq("requestId", request._id))
    .take(MAX_LINES);
  return {
    requestId: request._id,
    status: request.status,
    requesterId: request.requesterId,
    requesterName: user?.displayName ?? "Unknown member",
    requiresRestrictedApproval: request.requiresRestrictedApproval,
    note: request.note,
    decisionNote: request.decisionNote,
    createdAt: request.createdAt,
    lines: await Promise.all(
      lines.map(async (line) => {
        const item = await ctx.db.get(line.itemId);
        return {
          lineId: line._id,
          itemId: line.itemId,
          itemName: item?.name ?? "Unknown item",
          restricted: item?.restricted ?? false,
          quantity: line.quantity,
          fulfilledQuantity: line.fulfilledQuantity,
          quantityAvailable: item?.quantityAvailable ?? 0,
          status: line.status,
        };
      }),
    ),
  };
}

export const listQueue = query({
  args: { unitId: v.id("units"), status: v.optional(requestStatusValidator) },
  handler: async (ctx, { unitId, status }) => {
    await requireUnitPermission(ctx, unitId, "requests.approve");
    const statuses: RequestStatus[] = status
      ? [status]
      : ["submitted", "approved", "partially_fulfilled"];
    const requests: Doc<"requests">[] = [];
    for (const current of statuses) {
      requests.push(
        ...(await ctx.db
          .query("requests")
          .withIndex("by_unit_and_status", (q) => q.eq("unitId", unitId).eq("status", current))
          .order("desc")
          .take(MAX_ROWS)),
      );
    }
    requests.sort((a, b) => a.createdAt - b.createdAt);
    return await Promise.all(requests.map((request) => toRow(ctx, request)));
  },
});
