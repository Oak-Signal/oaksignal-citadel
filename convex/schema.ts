// Schema conventions (apply to every table added to this file):
// - Every table declares validators for all fields. `v.any()` is only allowed for the generic
//   before/after snapshots on `auditLog`, which hold arbitrary entity shapes.
// - Unit-owned tables carry a required `unitId: v.id("units")` and a `by_unit` (or `by_unit_and_*`) index.
// - Index names follow `by_<field>` or `by_<field1>_and_<field2>`, listing fields in index order.
// - Timestamps are epoch milliseconds (`v.number()`); Convex adds `_creationTime` automatically.
// - Uniqueness is enforced in mutations by checking the matching index before inserting.
// - `transactions`, `transactionLines`, and `auditLog` are append-only; corrections are new documents.
// - `itemId` is a plain string until the `items` table is added with the catalogue; it then
//   becomes `v.id("items")`.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  assignmentStatusValidator,
  membershipStatusValidator,
  permissionValidator,
  roleKeyValidator,
  transactionTypeValidator,
  unitSettingsValidator,
  unitStatusValidator,
} from "./lib/validators";

export default defineSchema({
  // Application profile linked to Clerk by a stable subject. Only application-level fields.
  users: defineTable({
    clerkSubject: v.string(),
    displayName: v.string(),
    email: v.string(),
    anonymizedAt: v.optional(v.number()),
    isPlatformAdmin: v.boolean(),
    lastSignInAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_subject", ["clerkSubject"])
    .index("by_email", ["email"]),

  units: defineTable({
    name: v.string(),
    identifier: v.string(),
    status: unitStatusValidator,
    settings: unitSettingsValidator,
    createdBy: v.id("users"),
    // Idempotency key for provisioning: a repeated submission returns the original unit.
    requestKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identifier", ["identifier"])
    .index("by_creator_and_requestKey", ["createdBy", "requestKey"])
    .index("by_status", ["status"]),

  memberships: defineTable({
    unitId: v.id("units"),
    userId: v.id("users"),
    roles: v.array(roleKeyValidator),
    extraPermissions: v.array(permissionValidator),
    revokedPermissions: v.array(permissionValidator),
    status: membershipStatusValidator,
    invitedBy: v.optional(v.id("users")),
    deactivatedAt: v.optional(v.number()),
    leftAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_unit_and_user", ["unitId", "userId"])
    .index("by_unit_and_status", ["unitId", "status"]),

  roleDefinitions: defineTable({
    unitId: v.id("units"),
    key: v.string(),
    name: v.string(),
    permissions: v.array(permissionValidator),
  })
    .index("by_unit", ["unitId"])
    .index("by_unit_and_key", ["unitId", "key"]),

  // Time-limited, verified permission for a Platform Administrator to act within one unit.
  supportGrants: defineTable({
    unitId: v.id("units"),
    platformAdminId: v.id("users"),
    verifiedByMembershipId: v.id("memberships"),
    reason: v.string(),
    expiresAt: v.number(),
  })
    .index("by_unit", ["unitId"])
    .index("by_platform_admin", ["platformAdminId"]),

  // Append-only. Written only through appendAudit() in convex/lib/audit.ts.
  auditLog: defineTable({
    unitId: v.optional(v.id("units")),
    actorId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    reason: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_unit_and_time", ["unitId", "occurredAt"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor", ["actorId"]),

  // Append-only inventory ledger. Corrections are new transactions.
  transactions: defineTable({
    unitId: v.id("units"),
    type: transactionTypeValidator,
    memberId: v.optional(v.id("memberships")),
    performedBy: v.id("users"),
    authorizedBy: v.optional(v.id("users")),
    requestId: v.optional(v.string()),
    correctsTransactionId: v.optional(v.id("transactions")),
    requestKey: v.string(),
    reason: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_unit_and_time", ["unitId", "occurredAt"])
    .index("by_unit_and_member", ["unitId", "memberId"])
    .index("by_unit_and_requestKey", ["unitId", "requestKey"]),

  transactionLines: defineTable({
    transactionId: v.id("transactions"),
    unitId: v.id("units"),
    itemId: v.string(),
    quantity: v.number(),
    conditionBefore: v.optional(v.string()),
    conditionAfter: v.optional(v.string()),
    fromLocationId: v.optional(v.string()),
    toLocationId: v.optional(v.string()),
    expectedReturnAt: v.optional(v.number()),
    assignmentId: v.optional(v.id("assignments")),
    note: v.optional(v.string()),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_unit_and_item", ["unitId", "itemId"]),

  assignments: defineTable({
    unitId: v.id("units"),
    itemId: v.string(),
    memberId: v.id("memberships"),
    quantityIssued: v.number(),
    quantityReturned: v.number(),
    issuedAt: v.number(),
    expectedReturnAt: v.optional(v.number()),
    status: assignmentStatusValidator,
    issueTransactionId: v.id("transactions"),
  })
    .index("by_unit_and_member", ["unitId", "memberId"])
    .index("by_unit_and_status", ["unitId", "status"])
    .index("by_item", ["itemId"]),

  notifications: defineTable({
    unitId: v.id("units"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    link: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_and_unread", ["userId", "readAt"])
    .index("by_unit", ["unitId"]),
});
