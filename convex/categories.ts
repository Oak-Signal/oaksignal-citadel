// Item categories. A category carries the unit's custom attribute definitions for its items.
// Categories are archived rather than deleted so existing items keep their classification.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireUnitPermission } from "./lib/authz";
import { conflict, notFound, validation } from "./lib/errors";
import { customAttributeDefValidator, requireText } from "./lib/validators";

const MAX_CUSTOM_ATTRIBUTES = 20;
const ATTRIBUTE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

type AttributeDef = Doc<"categories">["customAttributeDefs"][number];

export function normalizeAttributeDefs(defs: AttributeDef[]): AttributeDef[] {
  if (defs.length > MAX_CUSTOM_ATTRIBUTES) {
    throw validation(`A category can have at most ${MAX_CUSTOM_ATTRIBUTES} custom attributes.`);
  }
  const seen = new Set<string>();
  return defs.map((def) => {
    const key = def.key.trim();
    if (!ATTRIBUTE_KEY_PATTERN.test(key)) {
      throw validation(
        "Attribute keys must start with a lowercase letter and use only lowercase letters, numbers, and underscores.",
      );
    }
    if (seen.has(key)) throw validation(`Attribute key "${key}" is used more than once.`);
    seen.add(key);
    const label = requireText(def.label, "Attribute label", 100);
    if (def.type === "select") {
      const options = [...new Set((def.options ?? []).map((option) => option.trim()))].filter(
        (option) => option.length > 0,
      );
      if (options.length === 0) throw validation(`Attribute "${label}" needs at least one option.`);
      return { key, label, type: def.type, required: def.required, options };
    }
    return { key, label, type: def.type, required: def.required };
  });
}

async function assertNameFree(
  ctx: QueryCtx,
  unitId: Doc<"categories">["unitId"],
  name: string,
  exceptId?: Doc<"categories">["_id"],
) {
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_unit_and_name", (q) => q.eq("unitId", unitId).eq("name", name))
    .collect();
  if (existing.some((category) => category._id !== exceptId)) {
    throw conflict("A category with this name already exists.");
  }
}

export const list = query({
  args: { unitId: v.id("units"), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { unitId, includeArchived }) => {
    await requireUnitPermission(ctx, unitId, "inventory.view");
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .take(500);
    return categories
      .filter((category) => includeArchived || !category.archived)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    unitId: v.id("units"),
    name: v.string(),
    customAttributeDefs: v.optional(v.array(customAttributeDefValidator)),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUnitPermission(ctx, args.unitId, "inventory.manage");
    const name = requireText(args.name, "Name", 100);
    await assertNameFree(ctx, args.unitId, name);
    const doc = {
      unitId: args.unitId,
      name,
      customAttributeDefs: normalizeAttributeDefs(args.customAttributeDefs ?? []),
      archived: false,
    };
    const categoryId = await ctx.db.insert("categories", doc);
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "category.create",
      entityType: "categories",
      entityId: categoryId,
      after: doc,
    });
    return categoryId;
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    customAttributeDefs: v.optional(v.array(customAttributeDefValidator)),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw notFound("Category");
    const { user } = await requireUnitPermission(ctx, category.unitId, "inventory.manage");
    const patch: Partial<Doc<"categories">> = {};
    if (args.name !== undefined) {
      patch.name = requireText(args.name, "Name", 100);
      await assertNameFree(ctx, category.unitId, patch.name, category._id);
    }
    if (args.customAttributeDefs !== undefined) {
      patch.customAttributeDefs = normalizeAttributeDefs(args.customAttributeDefs);
    }
    await ctx.db.patch(category._id, patch);
    await appendAudit(ctx, {
      unitId: category.unitId,
      actorId: user._id,
      action: "category.update",
      entityType: "categories",
      entityId: category._id,
      before: { name: category.name, customAttributeDefs: category.customAttributeDefs },
      after: {
        name: patch.name ?? category.name,
        customAttributeDefs: patch.customAttributeDefs ?? category.customAttributeDefs,
      },
    });
  },
});

async function setArchived(
  ctx: MutationCtx,
  category: Doc<"categories">,
  actorId: Doc<"users">["_id"],
  archived: boolean,
) {
  if (category.archived === archived) return;
  await ctx.db.patch(category._id, { archived });
  await appendAudit(ctx, {
    unitId: category.unitId,
    actorId,
    action: archived ? "category.archive" : "category.restore",
    entityType: "categories",
    entityId: category._id,
    before: { archived: category.archived },
    after: { archived },
  });
}

export const archive = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const category = await ctx.db.get(categoryId);
    if (!category) throw notFound("Category");
    const { user } = await requireUnitPermission(ctx, category.unitId, "inventory.manage");
    await setArchived(ctx, category, user._id, true);
  },
});

export const restore = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, { categoryId }) => {
    const category = await ctx.db.get(categoryId);
    if (!category) throw notFound("Category");
    const { user } = await requireUnitPermission(ctx, category.unitId, "inventory.manage");
    await setArchived(ctx, category, user._id, false);
  },
});
