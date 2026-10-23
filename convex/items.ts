// Unit item catalogue: serialized assets and bulk stock. Quantities of bulk stock change only
// through ledger transactions (receive/adjust/issue/return); `update` never touches them.
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { appendAudit, readEntityAudit } from "./lib/audit";
import { requireUnitPermission } from "./lib/authz";
import { conflict, notFound, validation } from "./lib/errors";
import {
  ITEM_STATUSES,
  customAttributeValueValidator,
  itemConditionValidator,
  itemStatusValidator,
  requireText,
  trackingModeValidator,
  MAX_NOTE_LENGTH,
} from "./lib/validators";

type Item = Doc<"items">;
type AttributeValues = Item["customAttributes"];

// Statuses a person may set by hand. `issued` and `reserved` are owned by issuance and requests.
const MANUAL_STATUSES = ITEM_STATUSES.filter((s) => s !== "issued" && s !== "reserved");
const SYSTEM_STATUSES = new Set<string>(["issued", "reserved"]);

export function isLowStock(item: Pick<Item, "trackingMode" | "quantityAvailable" | "minThreshold">) {
  return (
    item.trackingMode === "bulk" &&
    item.minThreshold !== undefined &&
    item.quantityAvailable < item.minThreshold
  );
}

function withLowStock(item: Item) {
  return { ...item, lowStock: isLowStock(item) };
}

function snapshot(item: Item) {
  const { _id, _creationTime, ...rest } = item;
  void _id;
  void _creationTime;
  return rest;
}

function cleanOptional(value: string | undefined, field: string, max = 200) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > max) throw validation(`${field} must be at most ${max} characters.`);
  return trimmed;
}

function assertQuantity(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw validation(`${field} must be a whole number of zero or more.`);
  }
}

function assertThreshold(value: number | undefined) {
  if (value !== undefined) assertQuantity(value, "Minimum threshold");
}

async function loadUsableCategory(ctx: QueryCtx, unitId: Id<"units">, categoryId: Id<"categories">) {
  const category = await ctx.db.get(categoryId);
  if (!category || category.unitId !== unitId) throw validation("Choose a category from this unit.");
  return category;
}

// Checks values against the category's attribute definitions and drops unknown keys.
function validateCustomAttributes(category: Doc<"categories">, values: AttributeValues): AttributeValues {
  const result: AttributeValues = {};
  for (const def of category.customAttributeDefs) {
    const value = values[def.key];
    const missing = value === undefined || value === "";
    if (missing) {
      if (def.required) throw validation(`${def.label} is required.`);
      continue;
    }
    const ok =
      (def.type === "number" && typeof value === "number" && Number.isFinite(value)) ||
      (def.type === "boolean" && typeof value === "boolean") ||
      (def.type === "text" && typeof value === "string" && value.length <= 500) ||
      (def.type === "date" && typeof value === "string" && !Number.isNaN(Date.parse(value))) ||
      (def.type === "select" && typeof value === "string" && (def.options ?? []).includes(value));
    if (!ok) throw validation(`${def.label} has an invalid value.`);
    result[def.key] = value;
  }
  return result;
}

async function assertAssetTagFree(
  ctx: QueryCtx,
  unitId: Id<"units">,
  assetTag: string | undefined,
  exceptId?: Id<"items">,
) {
  if (assetTag === undefined) return;
  const matches = await ctx.db
    .query("items")
    .withIndex("by_unit_and_assetTag", (q) => q.eq("unitId", unitId).eq("assetTag", assetTag))
    .collect();
  if (matches.some((item) => item._id !== exceptId)) {
    throw conflict(`Asset tag "${assetTag}" is already used in this unit.`);
  }
}

const attributesArg = v.record(v.string(), customAttributeValueValidator);

export const create = mutation({
  args: {
    unitId: v.id("units"),
    name: v.string(),
    description: v.optional(v.string()),
    categoryId: v.id("categories"),
    trackingMode: trackingModeValidator,
    sku: v.optional(v.string()),
    assetTag: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    barcode: v.optional(v.string()),
    quantityOnHand: v.optional(v.number()),
    quantityAvailable: v.optional(v.number()),
    status: v.optional(itemStatusValidator),
    condition: itemConditionValidator,
    locationId: v.optional(v.string()),
    restricted: v.optional(v.boolean()),
    minThreshold: v.optional(v.number()),
    acquiredAt: v.optional(v.number()),
    supplier: v.optional(v.string()),
    customAttributes: v.optional(attributesArg),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUnitPermission(ctx, args.unitId, "inventory.manage");
    const category = await loadUsableCategory(ctx, args.unitId, args.categoryId);
    if (category.archived) throw validation("This category is archived.");

    const status = args.status ?? "available";
    if (SYSTEM_STATUSES.has(status)) {
      throw validation("New items cannot start as issued or reserved.");
    }
    const assetTag = cleanOptional(args.assetTag, "Asset tag", 100);
    await assertAssetTagFree(ctx, args.unitId, assetTag);
    assertThreshold(args.minThreshold);

    let quantityOnHand: number;
    let quantityAvailable: number;
    if (args.trackingMode === "serialized") {
      if (args.quantityOnHand !== undefined && args.quantityOnHand !== 1) {
        throw validation("Serialized items always have a quantity of 1.");
      }
      if (args.minThreshold !== undefined) {
        throw validation("Low-stock thresholds apply to bulk items only.");
      }
      quantityOnHand = 1;
      quantityAvailable = status === "available" ? 1 : 0;
    } else {
      quantityOnHand = args.quantityOnHand ?? 0;
      quantityAvailable = args.quantityAvailable ?? (status === "available" ? quantityOnHand : 0);
      assertQuantity(quantityOnHand, "Quantity on hand");
      assertQuantity(quantityAvailable, "Quantity available");
      if (quantityAvailable > quantityOnHand) {
        throw validation("Quantity available cannot exceed quantity on hand.");
      }
    }

    const now = Date.now();
    const doc: Omit<Item, "_id" | "_creationTime"> = {
      unitId: args.unitId,
      name: requireText(args.name, "Name", 200),
      description: (args.description ?? "").trim(),
      categoryId: args.categoryId,
      trackingMode: args.trackingMode,
      sku: cleanOptional(args.sku, "SKU", 100),
      assetTag,
      serialNumber: cleanOptional(args.serialNumber, "Serial number", 100),
      barcode: cleanOptional(args.barcode, "Barcode", 100),
      quantityOnHand,
      quantityAvailable,
      status,
      condition: args.condition,
      locationId: cleanOptional(args.locationId, "Location"),
      restricted: args.restricted ?? false,
      minThreshold: args.minThreshold,
      acquiredAt: args.acquiredAt,
      supplier: cleanOptional(args.supplier, "Supplier"),
      attachments: [],
      customAttributes: validateCustomAttributes(category, args.customAttributes ?? {}),
      notes: (args.notes ?? "").trim().slice(0, MAX_NOTE_LENGTH),
      archived: false,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: now,
    };
    if (doc.description.length > MAX_NOTE_LENGTH) {
      throw validation(`Description must be at most ${MAX_NOTE_LENGTH} characters.`);
    }
    const itemId = await ctx.db.insert("items", doc);
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "item.create",
      entityType: "items",
      entityId: itemId,
      after: doc,
    });
    return itemId;
  },
});

// Optional text fields: an empty string clears the value. Nullable fields: null clears.
export const update = mutation({
  args: {
    itemId: v.id("items"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    sku: v.optional(v.string()),
    assetTag: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    barcode: v.optional(v.string()),
    status: v.optional(itemStatusValidator),
    condition: v.optional(itemConditionValidator),
    locationId: v.optional(v.union(v.string(), v.null())),
    restricted: v.optional(v.boolean()),
    minThreshold: v.optional(v.union(v.number(), v.null())),
    acquiredAt: v.optional(v.union(v.number(), v.null())),
    supplier: v.optional(v.string()),
    customAttributes: v.optional(attributesArg),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw notFound("Item");
    const { user } = await requireUnitPermission(ctx, item.unitId, "inventory.manage");
    if (item.archived) throw conflict("Restore this item before editing it.");

    const patch: Partial<Item> = { updatedBy: user._id, updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = requireText(args.name, "Name", 200);
    if (args.description !== undefined) {
      patch.description = args.description.trim();
      if (patch.description.length > MAX_NOTE_LENGTH) {
        throw validation(`Description must be at most ${MAX_NOTE_LENGTH} characters.`);
      }
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim();
      if (patch.notes.length > MAX_NOTE_LENGTH) {
        throw validation(`Notes must be at most ${MAX_NOTE_LENGTH} characters.`);
      }
    }
    if (args.sku !== undefined) patch.sku = cleanOptional(args.sku, "SKU", 100);
    if (args.serialNumber !== undefined) {
      patch.serialNumber = cleanOptional(args.serialNumber, "Serial number", 100);
    }
    if (args.barcode !== undefined) patch.barcode = cleanOptional(args.barcode, "Barcode", 100);
    if (args.supplier !== undefined) patch.supplier = cleanOptional(args.supplier, "Supplier");
    if (args.condition !== undefined) patch.condition = args.condition;
    if (args.restricted !== undefined) patch.restricted = args.restricted;
    if (args.locationId !== undefined) {
      patch.locationId =
        args.locationId === null ? undefined : cleanOptional(args.locationId, "Location");
    }
    if (args.acquiredAt !== undefined) patch.acquiredAt = args.acquiredAt ?? undefined;
    if (args.minThreshold !== undefined) {
      if (args.minThreshold !== null && item.trackingMode === "serialized") {
        throw validation("Low-stock thresholds apply to bulk items only.");
      }
      assertThreshold(args.minThreshold ?? undefined);
      patch.minThreshold = args.minThreshold ?? undefined;
    }
    if (args.assetTag !== undefined) {
      const assetTag = cleanOptional(args.assetTag, "Asset tag", 100);
      await assertAssetTagFree(ctx, item.unitId, assetTag, item._id);
      patch.assetTag = assetTag;
    }

    const categoryId = args.categoryId ?? item.categoryId;
    if (args.categoryId !== undefined || args.customAttributes !== undefined) {
      const category = await loadUsableCategory(ctx, item.unitId, categoryId);
      if (args.categoryId !== undefined && args.categoryId !== item.categoryId && category.archived) {
        throw validation("This category is archived.");
      }
      patch.categoryId = categoryId;
      patch.customAttributes = validateCustomAttributes(
        category,
        args.customAttributes ?? item.customAttributes,
      );
    }

    if (args.status !== undefined && args.status !== item.status) {
      if (SYSTEM_STATUSES.has(item.status)) {
        throw conflict("Return or release this item before changing its status.");
      }
      if (!(MANUAL_STATUSES as readonly string[]).includes(args.status)) {
        throw validation("Issued and reserved are set by issuance and requests.");
      }
      patch.status = args.status;
      if (item.trackingMode === "serialized") {
        patch.quantityAvailable = args.status === "available" ? 1 : 0;
      }
    }

    await ctx.db.patch(item._id, patch);
    const updated = (await ctx.db.get(item._id))!;
    await appendAudit(ctx, {
      unitId: item.unitId,
      actorId: user._id,
      action: "item.update",
      entityType: "items",
      entityId: item._id,
      before: snapshot(item),
      after: snapshot(updated),
    });
  },
});

async function hasOpenAssignment(ctx: QueryCtx, itemId: Id<"items">) {
  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_item", (q) => q.eq("itemId", itemId))
    .collect();
  return assignments.some((assignment) => assignment.status !== "closed");
}

export const archive = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw notFound("Item");
    const { user } = await requireUnitPermission(ctx, item.unitId, "inventory.manage");
    if (item.archived) return;
    if (SYSTEM_STATUSES.has(item.status) || (await hasOpenAssignment(ctx, itemId))) {
      throw conflict("This item is issued or reserved. Return it before archiving.");
    }
    await ctx.db.patch(itemId, { archived: true, updatedBy: user._id, updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId: item.unitId,
      actorId: user._id,
      action: "item.archive",
      entityType: "items",
      entityId: itemId,
      before: { archived: false },
      after: { archived: true },
    });
  },
});

export const restore = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) throw notFound("Item");
    const { user } = await requireUnitPermission(ctx, item.unitId, "inventory.manage");
    if (!item.archived) return;
    await ctx.db.patch(itemId, { archived: false, updatedBy: user._id, updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId: item.unitId,
      actorId: user._id,
      action: "item.restore",
      entityType: "items",
      entityId: itemId,
      before: { archived: true },
      after: { archived: false },
    });
  },
});

const filtersArgs = {
  categoryId: v.optional(v.id("categories")),
  condition: v.optional(itemConditionValidator),
  locationId: v.optional(v.string()),
  status: v.optional(itemStatusValidator),
  assigneeId: v.optional(v.id("memberships")),
  restricted: v.optional(v.boolean()),
  includeArchived: v.optional(v.boolean()),
};

type Filters = {
  categoryId?: Id<"categories">;
  condition?: Item["condition"];
  locationId?: string;
  status?: Item["status"];
  assigneeId?: Id<"memberships">;
  restricted?: boolean;
  includeArchived?: boolean;
};

function matchesFilters(item: Item, f: Filters) {
  return (
    (f.includeArchived || !item.archived) &&
    (f.categoryId === undefined || item.categoryId === f.categoryId) &&
    (f.condition === undefined || item.condition === f.condition) &&
    (f.locationId === undefined || item.locationId === f.locationId) &&
    (f.status === undefined || item.status === f.status) &&
    (f.assigneeId === undefined || item.currentAssigneeId === f.assigneeId) &&
    (f.restricted === undefined || item.restricted === f.restricted)
  );
}

// Pagination uses the most selective index available; the other filters run as database
// filters, so pages can be shorter than requested but never skip matches.
export const list = query({
  args: {
    unitId: v.id("units"),
    ...filtersArgs,
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireUnitPermission(ctx, args.unitId, "inventory.view");
    const { unitId } = args;
    let base;
    if (args.status !== undefined) {
      base = ctx.db
        .query("items")
        .withIndex("by_unit_and_status", (q) => q.eq("unitId", unitId).eq("status", args.status!));
    } else if (args.categoryId !== undefined) {
      base = ctx.db
        .query("items")
        .withIndex("by_unit_and_category", (q) =>
          q.eq("unitId", unitId).eq("categoryId", args.categoryId!),
        );
    } else if (args.assigneeId !== undefined) {
      base = ctx.db
        .query("items")
        .withIndex("by_unit_and_assignee", (q) =>
          q.eq("unitId", unitId).eq("currentAssigneeId", args.assigneeId!),
        );
    } else if (args.locationId !== undefined) {
      base = ctx.db
        .query("items")
        .withIndex("by_unit_and_location", (q) =>
          q.eq("unitId", unitId).eq("locationId", args.locationId!),
        );
    } else {
      base = ctx.db.query("items").withIndex("by_unit", (q) => q.eq("unitId", unitId));
    }
    const result = await base
      .order(args.order ?? "desc")
      .filter((q) =>
        q.and(
          args.includeArchived ? q.eq(1, 1) : q.eq(q.field("archived"), false),
          args.condition === undefined ? q.eq(1, 1) : q.eq(q.field("condition"), args.condition),
          args.restricted === undefined
            ? q.eq(1, 1)
            : q.eq(q.field("restricted"), args.restricted),
          args.status === undefined ? q.eq(1, 1) : q.eq(q.field("status"), args.status),
          args.categoryId === undefined
            ? q.eq(1, 1)
            : q.eq(q.field("categoryId"), args.categoryId),
          args.assigneeId === undefined
            ? q.eq(1, 1)
            : q.eq(q.field("currentAssigneeId"), args.assigneeId),
          args.locationId === undefined
            ? q.eq(1, 1)
            : q.eq(q.field("locationId"), args.locationId),
        ),
      )
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(withLowStock) };
  },
});

const SEARCH_LIMIT = 25;

export const search = query({
  args: { unitId: v.id("units"), text: v.string(), ...filtersArgs },
  handler: async (ctx, args) => {
    await requireUnitPermission(ctx, args.unitId, "inventory.view");
    const text = args.text.trim();
    if (text.length === 0) return [];
    const archived = args.includeArchived ? undefined : false;
    const byField = async (index: "search_name" | "search_assetTag", field: "name" | "assetTag") =>
      await ctx.db
        .query("items")
        .withSearchIndex(index, (q) => {
          const scoped = q.search(field, text).eq("unitId", args.unitId);
          return archived === undefined ? scoped : scoped.eq("archived", archived);
        })
        .take(SEARCH_LIMIT);
    const [byName, byTag] = await Promise.all([
      byField("search_name", "name"),
      byField("search_assetTag", "assetTag"),
    ]);
    const seen = new Set<string>();
    const merged: Item[] = [];
    for (const item of [...byTag, ...byName]) {
      if (seen.has(item._id) || !matchesFilters(item, args)) continue;
      seen.add(item._id);
      merged.push(item);
    }
    return merged.map(withLowStock);
  },
});

export const get = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) return null;
    await requireUnitPermission(ctx, item.unitId, "inventory.view");
    const category = await ctx.db.get(item.categoryId);
    const imageUrl = item.imageStorageId ? await ctx.storage.getUrl(item.imageStorageId) : null;
    const attachments = await Promise.all(
      item.attachments.map(async (attachment) => ({
        ...attachment,
        url: await ctx.storage.getUrl(attachment.storageId),
      })),
    );
    return {
      ...withLowStock(item),
      categoryName: category?.name ?? "Unknown",
      customAttributeDefs: category?.customAttributeDefs ?? [],
      imageUrl,
      attachments,
    };
  },
});

const HISTORY_LIMIT = 100;

export const history = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) return [];
    await requireUnitPermission(ctx, item.unitId, "inventory.view");

    const lines = await ctx.db
      .query("transactionLines")
      .withIndex("by_unit_and_item", (q) => q.eq("unitId", item.unitId).eq("itemId", itemId))
      .order("desc")
      .take(HISTORY_LIMIT);
    const transactionEntries = await Promise.all(
      lines.map(async (line) => {
        const transaction = await ctx.db.get(line.transactionId);
        if (!transaction) return null;
        return {
          kind: "transaction" as const,
          at: transaction.occurredAt,
          type: transaction.type,
          quantity: line.quantity,
          reason: transaction.reason,
          note: line.note,
          actorId: transaction.performedBy,
        };
      }),
    );
    const audits = await readEntityAudit(ctx, "items", itemId, HISTORY_LIMIT);
    const auditEntries = audits.map((entry) => ({
      kind: "audit" as const,
      at: entry.occurredAt,
      action: entry.action,
      reason: entry.reason,
      actorId: entry.actorId,
    }));
    // Incident entries join this feed when the incidents table is added (US7).
    return [...transactionEntries.filter((e) => e !== null), ...auditEntries]
      .sort((a, b) => b.at - a.at)
      .slice(0, HISTORY_LIMIT);
  },
});
