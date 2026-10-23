// Item images and attachments in Convex file storage. Upload URLs are issued only to users who
// can manage inventory, and a stored file is accepted only after its size and type are checked.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireUnitPermission } from "./lib/authz";
import { conflict, notFound, validation } from "./lib/errors";
import { requireText } from "./lib/validators";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ATTACHMENT_TYPES = [...IMAGE_TYPES, "application/pdf", "text/plain", "text/csv"];

export const generateUploadUrl = mutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireUnitPermission(ctx, unitId, "inventory.manage");
    return await ctx.storage.generateUploadUrl();
  },
});

// Reads what storage recorded for the upload; deletes it when it does not qualify.
async function checkUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  allowedTypes: string[],
  maxBytes: number,
) {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta) throw notFound("Uploaded file");
  const typeOk = meta.contentType !== undefined && allowedTypes.includes(meta.contentType);
  if (!typeOk || meta.size > maxBytes) {
    await ctx.storage.delete(storageId);
    throw validation(
      typeOk
        ? `That file is too large (limit ${Math.round(maxBytes / 1024 / 1024)} MB).`
        : "That file type is not allowed.",
    );
  }
  return meta;
}

async function loadItem(ctx: MutationCtx, itemId: Id<"items">) {
  const item = await ctx.db.get(itemId);
  if (!item) throw notFound("Item");
  return item;
}

function assertEditable(item: Doc<"items">) {
  if (item.archived) throw conflict("Restore this item before editing it.");
}
export const setItemImage = mutation({
  args: { itemId: v.id("items"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const item = await loadItem(ctx, args.itemId);
    const { user } = await requireUnitPermission(ctx, item.unitId, "inventory.manage");
    assertEditable(item);
    await checkUpload(ctx, args.storageId, IMAGE_TYPES, MAX_IMAGE_BYTES);
    await ctx.db.patch(item._id, {
      imageStorageId: args.storageId,
      updatedBy: user._id,
      updatedAt: Date.now(),
    });
    if (item.imageStorageId) await ctx.storage.delete(item.imageStorageId);
    await appendAudit(ctx, {
      unitId: item.unitId,
      actorId: user._id,
      action: "item.image.set",
      entityType: "items",
      entityId: item._id,
      before: { imageStorageId: item.imageStorageId },
      after: { imageStorageId: args.storageId },
    });
  },
});

export const removeItemImage = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, { itemId }) => {
    const item = await loadItem(ctx, itemId);
    const { user } = await requireUnitPermission(ctx, item.unitId, "inventory.manage");
    assertEditable(item);
    if (!item.imageStorageId) return;
    await ctx.db.patch(item._id, {
      imageStorageId: undefined,
      updatedBy: user._id,
      updatedAt: Date.now(),
    });
    await ctx.storage.delete(item.imageStorageId);
    await appendAudit(ctx, {
      unitId: item.unitId,
      actorId: user._id,
      action: "item.image.remove",
      entityType: "items",
      entityId: item._id,
      before: { imageStorageId: item.imageStorageId },
    });
  },
});

export const addAttachment = mutation({
  args: { itemId: v.id("items"), storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, args) => {
    const item = await loadItem(ctx, args.itemId);
    const { user } = await requireUnitPermission(ctx, item.unitId, "inventory.manage");
    assertEditable(item);
    const meta = await checkUpload(ctx, args.storageId, ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES);
    if (item.attachments.length >= MAX_ATTACHMENTS) {
      await ctx.storage.delete(args.storageId);
      throw conflict(`An item can have at most ${MAX_ATTACHMENTS} attachments.`);
    }
    const attachment = {
      storageId: args.storageId,
      name: requireText(args.name, "File name", 200),
      contentType: meta.contentType,
      size: meta.size,
    };
    await ctx.db.patch(item._id, {
      attachments: [...item.attachments, attachment],
      updatedBy: user._id,
      updatedAt: Date.now(),
    });
    await appendAudit(ctx, {
      unitId: item.unitId,
      actorId: user._id,
      action: "item.attachment.add",
      entityType: "items",
      entityId: item._id,
      after: { name: attachment.name, storageId: args.storageId },
    });
  },
});

export const removeAttachment = mutation({
  args: { itemId: v.id("items"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const item = await loadItem(ctx, args.itemId);
    const { user } = await requireUnitPermission(ctx, item.unitId, "inventory.manage");
    assertEditable(item);
    const target = item.attachments.find((a) => a.storageId === args.storageId);
    if (!target) throw notFound("Attachment");
    await ctx.db.patch(item._id, {
      attachments: item.attachments.filter((a) => a.storageId !== args.storageId),
      updatedBy: user._id,
      updatedAt: Date.now(),
    });
    await ctx.storage.delete(args.storageId);
    await appendAudit(ctx, {
      unitId: item.unitId,
      actorId: user._id,
      action: "item.attachment.remove",
      entityType: "items",
      entityId: item._id,
      before: { name: target.name, storageId: args.storageId },
    });
  },
});
