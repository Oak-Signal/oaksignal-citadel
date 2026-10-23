// Audit trail writer. `appendAudit()` is the ONLY code allowed to insert into `auditLog`
// (enforced by tests/convex/guard.test.ts). The entry is written with the caller's
// transaction, so it commits or rolls back together with the change it describes.
//
// Usage in a mutation:
//   const { user } = await requireUnitPermission(ctx, unitId, "inventory.manage");
//   const id = await ctx.db.insert("items", { ... });
//   await appendAudit(ctx, { unitId, actorId: user._id, action: "item.create",
//     entityType: "items", entityId: id, after: doc });
//
// A mutation that throws rolls back its audit entry too, so failures that must be recorded
// (for example permission denials) return a result instead of throwing; see
// recordPermissionDenied() in authz.ts.
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type AuditEntry = {
  unitId?: Id<"units">;
  actorId: Id<"users">;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

export async function appendAudit(ctx: MutationCtx, entry: AuditEntry): Promise<Id<"auditLog">> {
  return await ctx.db.insert("auditLog", { ...entry, occurredAt: Date.now() });
}

// Most recent audit entries for one entity, newest first.
export async function readEntityAudit(
  ctx: QueryCtx,
  entityType: string,
  entityId: string,
  limit: number,
) {
  return await ctx.db
    .query("auditLog")
    .withIndex("by_entity", (q) => q.eq("entityType", entityType).eq("entityId", entityId))
    .order("desc")
    .take(limit);
}
