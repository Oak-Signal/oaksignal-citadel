// Membership rules shared by the units, memberships, roles, and supportGrants functions:
// email normalization, role lists, the last-administrator rule, and the invitation helper.
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appendAudit } from "./audit";
import { conflict, validation } from "./errors";
import { ADMIN_ROLE, type RoleKey } from "./permissions";

type Ctx = QueryCtx | MutationCtx;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL_LENGTH = 254;
export const PLACEHOLDER_PREFIX = "invited:";

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw validation("Enter a valid email address.");
  }
  return email;
}

// Removes duplicates and requires at least one role.
export function normalizeRoles(roles: readonly RoleKey[]): RoleKey[] {
  const unique = [...new Set(roles)];
  if (unique.length === 0) throw validation("Choose at least one role.");
  return unique;
}

// Active administrators of a unit, optionally ignoring one membership (the one being changed).
export async function countActiveAdmins(
  ctx: Ctx,
  unitId: Id<"units">,
  excluding?: Id<"memberships">,
): Promise<number> {
  const active = await ctx.db
    .query("memberships")
    .withIndex("by_unit_and_status", (q) => q.eq("unitId", unitId).eq("status", "active"))
    .collect();
  return active.filter(
    (membership) => membership._id !== excluding && membership.roles.includes(ADMIN_ROLE),
  ).length;
}

export async function loadRoleOverrides(
  ctx: Ctx,
  unitId: Id<"units">,
): Promise<Record<string, readonly string[]>> {
  const definitions = await ctx.db
    .query("roleDefinitions")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  const overrides: Record<string, readonly string[]> = {};
  for (const definition of definitions) overrides[definition.key] = definition.permissions;
  return overrides;
}

// Finds the profile for an email, or creates a placeholder profile that the person claims when
// they first sign in with that email (see users.syncCurrentUser). A placeholder holds no access
// until the pending membership is accepted by the signed-in owner.
async function userForInvite(ctx: MutationCtx, email: string): Promise<Id<"users">> {
  const matches = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  const existing = matches.find((user) => user.anonymizedAt === undefined);
  if (existing) return existing._id;
  const now = Date.now();
  return await ctx.db.insert("users", {
    clerkSubject: `${PLACEHOLDER_PREFIX}${email}`,
    displayName: email.split("@")[0],
    email,
    isPlatformAdmin: false,
    createdAt: now,
    updatedAt: now,
  });
}

// Attaches everything invited to a verified email to this signed-in profile and activates it
// (invitations are accepted automatically on sign-in). Memberships held by a placeholder profile
// move to the real profile and the placeholder is removed. Only call this with an email that
// Clerk has verified: the token claim or the Clerk server API.
export async function attachInvites(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string,
): Promise<void> {
  if (!email) return;
  const now = Date.now();
  const placeholder = await ctx.db
    .query("users")
    .withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", `${PLACEHOLDER_PREFIX}${email}`))
    .unique();

  if (placeholder && placeholder._id !== userId) {
    const moving = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", placeholder._id))
      .collect();
    for (const membership of moving) {
      const clash = await ctx.db
        .query("memberships")
        .withIndex("by_unit_and_user", (q) =>
          q.eq("unitId", membership.unitId).eq("userId", userId),
        )
        .unique();
      if (clash) await ctx.db.delete(membership._id);
      else await ctx.db.patch(membership._id, { userId, updatedAt: now });
    }
    await ctx.db.delete(placeholder._id);
  }

  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const membership of memberships) {
    if (membership.status !== "invited") continue;
    await ctx.db.patch(membership._id, { status: "active", updatedAt: now });
    await appendAudit(ctx, {
      unitId: membership.unitId,
      actorId: userId,
      action: "membership.accept",
      entityType: "memberships",
      entityId: membership._id,
      before: { status: "invited" },
      after: { status: "active" },
      reason: "accepted automatically on sign-in with the invited email",
    });
  }
}

// Creates a pending membership. The (unit, user) pair is unique: an active or pending
// membership is a conflict; an inactive one is re-invited with its history kept.
export async function inviteMember(
  ctx: MutationCtx,
  input: {
    unitId: Id<"units">;
    email: string;
    roles: readonly RoleKey[];
    invitedBy: Id<"users">;
  },
): Promise<Id<"memberships">> {
  const email = normalizeEmail(input.email);
  const roles = normalizeRoles(input.roles);
  const userId = await userForInvite(ctx, email);
  const existing = await ctx.db
    .query("memberships")
    .withIndex("by_unit_and_user", (q) => q.eq("unitId", input.unitId).eq("userId", userId))
    .unique();
  const now = Date.now();
  let membershipId: Id<"memberships">;

  if (existing) {
    if (existing.status !== "inactive") {
      throw conflict("This person is already a member or has a pending invitation.");
    }
    await ctx.db.patch(existing._id, {
      roles,
      status: "invited",
      invitedBy: input.invitedBy,
      deactivatedAt: undefined,
      leftAt: undefined,
      updatedAt: now,
    });
    membershipId = existing._id;
  } else {
    membershipId = await ctx.db.insert("memberships", {
      unitId: input.unitId,
      userId,
      roles,
      extraPermissions: [],
      revokedPermissions: [],
      status: "invited",
      invitedBy: input.invitedBy,
      createdAt: now,
      updatedAt: now,
    });
  }

  await appendAudit(ctx, {
    unitId: input.unitId,
    actorId: input.invitedBy,
    action: "membership.invite",
    entityType: "memberships",
    entityId: membershipId,
    after: { roles, status: "invited" },
  });
  return membershipId;
}
