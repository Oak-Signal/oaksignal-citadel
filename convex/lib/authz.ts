// Authorization helpers. Every protected Convex function must call one of these first.
// Behaviour is fail-closed: no identity, no profile, no active membership, or a missing
// permission all reject. Errors are generic and never reveal whether a unit or record exists.
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appendAudit } from "./audit";
import { forbidden, unauthenticated } from "./errors";
import { createLogger } from "./logger";
import { effectivePermissions, type Permission } from "./permissions";

type Ctx = QueryCtx | MutationCtx;

export type UnitAccess = {
  user: Doc<"users">;
  unit: Doc<"units">;
  membership: Doc<"memberships">;
  permissions: Set<Permission>;
};

const logger = createLogger({ function: "authz" });

export async function requireIdentity(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw unauthenticated();
  return identity;
}

// Resolves the signed-in user's profile. A user with no profile (not yet synced) or an
// anonymized profile has no access.
export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", identity.subject))
    .unique();
  if (!user || user.anonymizedAt !== undefined) {
    logger.warn("authz.no_profile");
    throw forbidden();
  }
  return user;
}

export async function requirePlatformAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!user.isPlatformAdmin) {
    logger.warn("authz.not_platform_admin", { userId: user._id });
    throw forbidden();
  }
  return user;
}

async function loadAccess(
  ctx: Ctx,
  user: Doc<"users">,
  unitId: Id<"units">,
): Promise<UnitAccess | null> {
  const unit = await ctx.db.get(unitId);
  if (!unit) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_unit_and_user", (q) => q.eq("unitId", unitId).eq("userId", user._id))
    .unique();
  if (!membership || membership.status !== "active") return null;

  const definitions = await ctx.db
    .query("roleDefinitions")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  const overrides: Record<string, readonly string[]> = {};
  for (const definition of definitions) overrides[definition.key] = definition.permissions;

  return { user, unit, membership, permissions: effectivePermissions(membership, overrides) };
}

// Requires an active membership in the unit; used for self-service reads limited to own data.
export async function requireUnitMember(ctx: Ctx, unitId: Id<"units">): Promise<UnitAccess> {
  const user = await requireUser(ctx);
  const access = await loadAccess(ctx, user, unitId);
  if (!access) {
    logger.warn("authz.not_member", { userId: user._id, unitId });
    throw forbidden();
  }
  return access;
}

export async function requireUnitPermission(
  ctx: Ctx,
  unitId: Id<"units">,
  permission: Permission,
): Promise<UnitAccess> {
  const access = await requireUnitMember(ctx, unitId);
  if (!access.permissions.has(permission)) {
    logger.warn("authz.permission_denied", {
      userId: access.user._id,
      unitId,
      permission,
    });
    throw forbidden();
  }
  return access;
}

export type PermissionCheck =
  { allowed: true; access: UnitAccess } | { allowed: false; userId?: Id<"users"> };

// Non-throwing variant for mutations that must record a denial. A thrown error rolls the
// whole transaction back (including any audit entry), so such mutations call this, then
// recordPermissionDenied(), and return an error result.
export async function checkUnitPermission(
  ctx: Ctx,
  unitId: Id<"units">,
  permission: Permission,
): Promise<PermissionCheck> {
  const user = await requireUser(ctx);
  const access = await loadAccess(ctx, user, unitId);
  if (access && access.permissions.has(permission)) return { allowed: true, access };
  logger.warn("authz.permission_denied", { userId: user._id, unitId, permission });
  return { allowed: false, userId: user._id };
}

export async function recordPermissionDenied(
  ctx: MutationCtx,
  details: { userId: Id<"users">; unitId: Id<"units">; permission: Permission },
): Promise<void> {
  await appendAudit(ctx, {
    unitId: details.unitId,
    actorId: details.userId,
    action: "auth.permission_denied",
    entityType: "permission",
    entityId: details.permission,
  });
}
