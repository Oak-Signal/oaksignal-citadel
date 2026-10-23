// Unit-adjustable role permissions. A unit can change what each system role grants within the
// permission catalogue; platform administration is never part of a role. The Unit Administrator
// role always keeps the management permissions so a unit cannot lock itself out.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireUnitPermission } from "./lib/authz";
import { conflict, validation } from "./lib/errors";
import {
  ADMIN_ROLE,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_KEYS,
  ROLE_LABELS,
  isRoleKey,
  type Permission,
} from "./lib/permissions";
import { permissionValidator } from "./lib/validators";

const REQUIRED_ADMIN_PERMISSIONS: Permission[] = [
  "members.manage",
  "roles.manage",
  "unit.settings",
];

export const list = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireUnitPermission(ctx, unitId, "roles.manage");
    const definitions = await ctx.db
      .query("roleDefinitions")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    return ROLE_KEYS.map((key) => {
      const override = definitions.find((definition) => definition.key === key);
      return {
        key,
        name: ROLE_LABELS[key],
        defaultPermissions: [...DEFAULT_ROLE_PERMISSIONS[key]],
        permissions: override ? override.permissions : [...DEFAULT_ROLE_PERMISSIONS[key]],
        overridden: override !== undefined,
      };
    });
  },
});

export const update = mutation({
  args: { unitId: v.id("units"), key: v.string(), permissions: v.array(permissionValidator) },
  handler: async (ctx, args) => {
    const { user } = await requireUnitPermission(ctx, args.unitId, "roles.manage");
    if (!isRoleKey(args.key)) throw validation("Unknown role.");
    const permissions = [...new Set(args.permissions)];
    if (
      args.key === ADMIN_ROLE &&
      REQUIRED_ADMIN_PERMISSIONS.some((required) => !permissions.includes(required))
    ) {
      throw conflict(
        "The Unit Administrator role must keep member, role, and settings management.",
      );
    }
    const existing = await ctx.db
      .query("roleDefinitions")
      .withIndex("by_unit_and_key", (q) => q.eq("unitId", args.unitId).eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { permissions });
    } else {
      await ctx.db.insert("roleDefinitions", {
        unitId: args.unitId,
        key: args.key,
        name: ROLE_LABELS[args.key],
        permissions,
      });
    }
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "role.update",
      entityType: "roleDefinitions",
      entityId: args.key,
      before: { permissions: existing?.permissions ?? [...DEFAULT_ROLE_PERMISSIONS[args.key]] },
      after: { permissions },
    });
  },
});

// Removes the override so the role returns to the system default.
export const reset = mutation({
  args: { unitId: v.id("units"), key: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUnitPermission(ctx, args.unitId, "roles.manage");
    if (!isRoleKey(args.key)) throw validation("Unknown role.");
    const existing = await ctx.db
      .query("roleDefinitions")
      .withIndex("by_unit_and_key", (q) => q.eq("unitId", args.unitId).eq("key", args.key))
      .unique();
    if (!existing) return;
    await ctx.db.delete(existing._id);
    await appendAudit(ctx, {
      unitId: args.unitId,
      actorId: user._id,
      action: "role.reset",
      entityType: "roleDefinitions",
      entityId: args.key,
      before: { permissions: existing.permissions },
    });
  },
});
