// Atomic data-changing helpers. A Convex mutation is one transaction, so everything done in a
// single mutation (ledger rows, balance changes, audit entry) commits or fails together.
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { MAX_REQUEST_KEY_LENGTH } from "./validators";
import { validation } from "./errors";

export function assertRequestKey(requestKey: string): string {
  const key = requestKey.trim();
  if (key.length === 0 || key.length > MAX_REQUEST_KEY_LENGTH) {
    throw validation("A valid request key is required.");
  }
  return key;
}

export async function findTransactionByRequestKey(
  ctx: QueryCtx | MutationCtx,
  unitId: Id<"units">,
  requestKey: string,
) {
  return await ctx.db
    .query("transactions")
    .withIndex("by_unit_and_requestKey", (q) => q.eq("unitId", unitId).eq("requestKey", requestKey))
    .unique();
}

export type IdempotentResult = { transactionId: Id<"transactions">; replayed: boolean };

// Runs `create` once per (unit, requestKey). A repeat with the same key returns the original
// transaction id without running `create` again, so a double-submit cannot issue stock twice.
export async function runIdempotent(
  ctx: MutationCtx,
  unitId: Id<"units">,
  requestKey: string,
  create: () => Promise<Id<"transactions">>,
): Promise<IdempotentResult> {
  const key = assertRequestKey(requestKey);
  const existing = await findTransactionByRequestKey(ctx, unitId, key);
  if (existing) return { transactionId: existing._id, replayed: true };
  return { transactionId: await create(), replayed: false };
}
