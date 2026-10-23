// Inventory ledger writes for the catalogue: received stock and authorized adjustments.
// Each mutation writes the transaction, its line, the balance change, and the audit entry
// together, so they commit or fail as one. Quantities are never edited outside the ledger.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireUnitPermission } from "./lib/authz";
import { conflict, notFound, validation } from "./lib/errors";
import { assertRequestKey, findTransactionByRequestKey } from "./lib/mutations";
import { MAX_NOTE_LENGTH, requireText } from "./lib/validators";

const MAX_QUANTITY = 1_000_000;

function assertBulkItem(item: Doc<"items"> | null, unitId: Doc<"items">["unitId"]) {
  if (!item || item.unitId !== unitId) throw notFound("Item");
  if (item.archived) throw conflict("Restore this item before changing its stock.");
  if (item.trackingMode !== "bulk") {
    throw validation("Stock quantities apply to bulk items. Serialized items always have a quantity of 1.");
  }
  return item;
}

export const receiveStock = mutation({
  args: {
    unitId: v.id("units"),
    itemId: v.id("items"),
    quantity: v.number(),
    requestKey: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUnitPermission(ctx, args.unitId, "inventory.manage");
    const requestKey = assertRequestKey(args.requestKey);
    const replay = await findTransactionByRequestKey(ctx, args.unitId, requestKey);
    if (replay) return { transactionId: replay._id, replayed: true };

    const item = assertBulkItem(await ctx.db.get(args.itemId), args.unitId);
    if (!Number.isInteger(args.quantity) || args.quantity < 1 || args.quantity > MAX_QUANTITY) {
      throw validation(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
    }
    const note = args.note?.trim() || undefined;
    if (note && note.length > MAX_NOTE_LENGTH) {
      throw validation(`Note must be at most ${MAX_NOTE_LENGTH} characters.`);
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      unitId: args.unitId,
      type: "receive",
      performedBy: user._id,
      requestKey,
      reason: note,
      occurredAt: now,
    });
    await ctx.db.insert("transactionLines", {
      transactionId,
      unitId: args.unitId,
      itemId: item._id,
      quantity: args.quantity,
      note,
    });
    const after = {
      quantityOnHand: item.quantityOnHand + args.quantity,
      quantityAvailable: item.quantityAvailable + args.quantity,
    };
    await ctx.db.patch(item._id, { ...after, updatedBy: user._id, updatedAt: now });
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "stock.receive",
      entityType: "items",
      entityId: item._id,
      before: { quantityOnHand: item.quantityOnHand, quantityAvailable: item.quantityAvailable },
      after,
      reason: note,
    });
    return { transactionId, replayed: false };
  },
});

// `delta` is the signed change to quantity on hand (stock-take corrections, loss, write-offs).
export const adjustStock = mutation({
  args: {
    unitId: v.id("units"),
    itemId: v.id("items"),
    delta: v.number(),
    reason: v.string(),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUnitPermission(ctx, args.unitId, "inventory.adjust");
    const requestKey = assertRequestKey(args.requestKey);
    const replay = await findTransactionByRequestKey(ctx, args.unitId, requestKey);
    if (replay) return { transactionId: replay._id, replayed: true };

    const item = assertBulkItem(await ctx.db.get(args.itemId), args.unitId);
    const reason = requireText(args.reason, "Reason", MAX_NOTE_LENGTH);
    if (!Number.isInteger(args.delta) || args.delta === 0 || Math.abs(args.delta) > MAX_QUANTITY) {
      throw validation("The adjustment must be a non-zero whole number.");
    }
    const quantityOnHand = item.quantityOnHand + args.delta;
    const quantityAvailable = item.quantityAvailable + args.delta;
    if (quantityOnHand < 0) throw validation("Quantity on hand cannot go below zero.");
    if (quantityAvailable < 0) {
      throw conflict("Part of this stock is issued. Return it before reducing the quantity.");
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      unitId: args.unitId,
      type: "adjust",
      performedBy: user._id,
      authorizedBy: user._id,
      requestKey,
      reason,
      occurredAt: now,
    });
    await ctx.db.insert("transactionLines", {
      transactionId,
      unitId: args.unitId,
      itemId: item._id,
      quantity: args.delta,
      note: reason,
    });
    await ctx.db.patch(item._id, {
      quantityOnHand,
      quantityAvailable,
      updatedBy: user._id,
      updatedAt: now,
    });
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "stock.adjust",
      entityType: "items",
      entityId: item._id,
      before: { quantityOnHand: item.quantityOnHand, quantityAvailable: item.quantityAvailable },
      after: { quantityOnHand, quantityAvailable },
      reason,
    });
    return { transactionId, replayed: false };
  },
});
