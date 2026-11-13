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
import {
  MAX_NOTE_LENGTH,
  itemConditionValidator,
  requireText,
} from "./lib/validators";

const MAX_QUANTITY = 1_000_000;
const MAX_LINES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// Statuses that stop an item from being issued (FR-019).
const BLOCKING_STATUSES = new Set([
  "issued",
  "reserved",
  "damaged",
  "missing",
  "unserviceable",
  "maintenance",
  "retired",
]);

function assertLineCount(count: number) {
  if (count < 1) throw validation("Add at least one item.");
  if (count > MAX_LINES) throw validation(`A transaction can have at most ${MAX_LINES} items.`);
}

function cleanNote(note: string | undefined, field = "Note") {
  const trimmed = note?.trim() || undefined;
  if (trimmed && trimmed.length > MAX_NOTE_LENGTH) {
    throw validation(`${field} must be at most ${MAX_NOTE_LENGTH} characters.`);
  }
  return trimmed;
}

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

// Issues one or more items to an active member. Every check runs before the first write is
// visible: a thrown error rolls the whole mutation back, so a multi-line issue is all or nothing.
// Convex serializes conflicting mutations, so two operators issuing the last unit cannot both win.
export const issue = mutation({
  args: {
    unitId: v.id("units"),
    memberId: v.id("memberships"),
    lines: v.array(
      v.object({
        itemId: v.id("items"),
        quantity: v.number(),
        condition: v.optional(itemConditionValidator),
      }),
    ),
    expectedReturnAt: v.optional(v.number()),
    note: v.optional(v.string()),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, unit } = await requireUnitPermission(ctx, args.unitId, "issuance.perform");
    const requestKey = assertRequestKey(args.requestKey);
    const replay = await findTransactionByRequestKey(ctx, args.unitId, requestKey);
    if (replay) return { transactionId: replay._id, replayed: true };

    assertLineCount(args.lines.length);
    const note = cleanNote(args.note);
    const member = await ctx.db.get(args.memberId);
    if (!member || member.unitId !== args.unitId || member.status !== "active") {
      throw validation("Choose an active member of this unit.");
    }
    if (new Set(args.lines.map((line) => line.itemId)).size !== args.lines.length) {
      throw validation("Each item can appear only once. Combine the quantities instead.");
    }

    const now = Date.now();
    const expectedReturnAt =
      args.expectedReturnAt ?? now + unit.settings.defaultReturnDays * DAY_MS;
    if (!Number.isFinite(expectedReturnAt) || expectedReturnAt < now - DAY_MS) {
      throw validation("The expected return date cannot be in the past.");
    }
    if (expectedReturnAt > now + 5 * 365 * DAY_MS) {
      throw validation("The expected return date is too far in the future.");
    }

    const transactionId = await ctx.db.insert("transactions", {
      unitId: args.unitId,
      type: "issue",
      memberId: args.memberId,
      performedBy: user._id,
      requestKey,
      reason: note,
      occurredAt: now,
    });

    for (const line of args.lines) {
      const item = await ctx.db.get(line.itemId);
      if (!item || item.unitId !== args.unitId) throw notFound("Item");
      if (item.archived) throw conflict(`${item.name} is archived and cannot be issued.`);
      if (BLOCKING_STATUSES.has(item.status) || item.condition === "unserviceable") {
        throw conflict(`${item.name} is not available to issue.`);
      }
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
        throw validation(`Quantity for ${item.name} must be a whole number of 1 or more.`);
      }
      if (item.trackingMode === "serialized" && line.quantity !== 1) {
        throw validation(`${item.name} is a serialized asset and is issued one at a time.`);
      }
      if (line.quantity > item.quantityAvailable) {
        throw conflict(`Only ${item.quantityAvailable} of ${item.name} available.`);
      }
      if (line.condition === "unserviceable") {
        throw validation(`${item.name} cannot be issued as unserviceable.`);
      }
      const conditionAtIssue = line.condition ?? item.condition;

      const assignmentId = await ctx.db.insert("assignments", {
        unitId: args.unitId,
        itemId: item._id,
        memberId: args.memberId,
        quantityIssued: line.quantity,
        quantityReturned: 0,
        issuedAt: now,
        expectedReturnAt,
        status: "open",
        issueTransactionId: transactionId,
      });
      await ctx.db.insert("transactionLines", {
        transactionId,
        unitId: args.unitId,
        itemId: item._id,
        quantity: line.quantity,
        conditionBefore: item.condition,
        conditionAfter: conditionAtIssue,
        expectedReturnAt,
        assignmentId,
        note,
      });

      const quantityAvailable = item.quantityAvailable - line.quantity;
      const patch: Partial<Doc<"items">> = {
        quantityAvailable,
        condition: conditionAtIssue,
        updatedBy: user._id,
        updatedAt: now,
      };
      if (item.trackingMode === "serialized") {
        patch.status = "issued";
        patch.currentAssigneeId = args.memberId;
      }
      await ctx.db.patch(item._id, patch);
      await appendAudit(ctx, {
        unitId: args.unitId,
        actorId: user._id,
        action: "item.issue",
        entityType: "items",
        entityId: item._id,
        before: {
          status: item.status,
          quantityAvailable: item.quantityAvailable,
          currentAssigneeId: item.currentAssigneeId ?? null,
        },
        after: {
          status: patch.status ?? item.status,
          quantityAvailable,
          currentAssigneeId: patch.currentAssigneeId ?? item.currentAssigneeId ?? null,
          quantity: line.quantity,
          memberId: args.memberId,
          transactionId,
          expectedReturnAt,
        },
        reason: note,
      });
    }
    return { transactionId, replayed: false };
  },
});

// Records returns against open assignments. Each line names an assignment, the quantity coming
// back, the condition, and an outcome. Anything other than `available` is a discrepancy: it
// needs a note and keeps the item out of circulation (flagged for follow-up).
const returnItems = mutation({
  args: {
    unitId: v.id("units"),
    lines: v.array(
      v.object({
        assignmentId: v.id("assignments"),
        quantity: v.number(),
        condition: itemConditionValidator,
        outcome: v.union(
          v.literal("available"),
          v.literal("damaged"),
          v.literal("missing"),
          v.literal("unserviceable"),
        ),
        note: v.optional(v.string()),
      }),
    ),
    note: v.optional(v.string()),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUnitPermission(ctx, args.unitId, "issuance.perform");
    const requestKey = assertRequestKey(args.requestKey);
    const replay = await findTransactionByRequestKey(ctx, args.unitId, requestKey);
    if (replay) return { transactionId: replay._id, replayed: true };

    assertLineCount(args.lines.length);
    const note = cleanNote(args.note);
    if (new Set(args.lines.map((line) => line.assignmentId)).size !== args.lines.length) {
      throw validation("Each assignment can appear only once in a return.");
    }

    const assignments: Doc<"assignments">[] = [];
    for (const line of args.lines) {
      const assignment = await ctx.db.get(line.assignmentId);
      if (!assignment || assignment.unitId !== args.unitId) throw notFound("Assignment");
      assignments.push(assignment);
    }
    const memberId = assignments[0].memberId;
    if (assignments.some((assignment) => assignment.memberId !== memberId)) {
      throw validation("A return covers one member at a time.");
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("transactions", {
      unitId: args.unitId,
      type: "return",
      memberId,
      performedBy: user._id,
      requestKey,
      reason: note,
      occurredAt: now,
    });

    for (const [index, line] of args.lines.entries()) {
      const assignment = assignments[index];
      const item = await ctx.db.get(assignment.itemId);
      if (!item || item.unitId !== args.unitId) throw notFound("Item");
      const outstanding = assignment.quantityIssued - assignment.quantityReturned;
      if (assignment.status === "closed" || outstanding < 1) {
        throw conflict(`${item.name} has already been returned.`);
      }
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > outstanding) {
        throw validation(`Return between 1 and ${outstanding} of ${item.name}.`);
      }
      const lineNote = cleanNote(line.note, "Discrepancy note");
      const isDiscrepancy = line.outcome !== "available";
      if (isDiscrepancy && !lineNote) {
        throw validation(`Add a note explaining why ${item.name} is ${line.outcome}.`);
      }
      if (line.outcome === "available" && line.condition === "unserviceable") {
        throw validation(`${item.name} cannot go back into stock as unserviceable.`);
      }
      if (line.outcome === "unserviceable" && line.condition !== "unserviceable") {
        throw validation(`Set the condition of ${item.name} to unserviceable.`);
      }

      await ctx.db.insert("transactionLines", {
        transactionId,
        unitId: args.unitId,
        itemId: item._id,
        quantity: line.quantity,
        conditionBefore: item.condition,
        conditionAfter: line.condition,
        assignmentId: assignment._id,
        note: lineNote,
      });

      const quantityReturned = assignment.quantityReturned + line.quantity;
      const closed = quantityReturned >= assignment.quantityIssued;
      await ctx.db.patch(assignment._id, {
        quantityReturned,
        status: closed ? "closed" : "partially_returned",
      });

      const patch: Partial<Doc<"items">> = {
        condition: line.condition,
        updatedBy: user._id,
        updatedAt: now,
      };
      if (item.trackingMode === "serialized") {
        patch.currentAssigneeId = undefined;
        patch.status = line.outcome === "available" ? "available" : line.outcome;
        patch.quantityAvailable = line.outcome === "available" ? 1 : 0;
      } else if (line.outcome === "available") {
        patch.quantityAvailable = item.quantityAvailable + line.quantity;
      } else {
        // Units that come back damaged, missing, or unserviceable leave circulating stock.
        patch.quantityOnHand = item.quantityOnHand - line.quantity;
      }
      await ctx.db.patch(item._id, patch);
      await appendAudit(ctx, {
        unitId: args.unitId,
        actorId: user._id,
        action: "item.return",
        entityType: "items",
        entityId: item._id,
        before: {
          status: item.status,
          condition: item.condition,
          quantityOnHand: item.quantityOnHand,
          quantityAvailable: item.quantityAvailable,
          currentAssigneeId: item.currentAssigneeId ?? null,
        },
        after: {
          status: patch.status ?? item.status,
          condition: line.condition,
          quantityOnHand: patch.quantityOnHand ?? item.quantityOnHand,
          quantityAvailable: patch.quantityAvailable ?? item.quantityAvailable,
          currentAssigneeId:
            item.trackingMode === "serialized" ? null : (item.currentAssigneeId ?? null),
          quantity: line.quantity,
          outcome: line.outcome,
          memberId,
          assignmentId: assignment._id,
          transactionId,
        },
        reason: lineNote ?? note,
      });
    }
    return { transactionId, replayed: false };
  },
});

// "return" is a reserved word, so the mutation is exported under that name.
export { returnItems as return };
