// Membership functions: invitations, acceptance, role assignment, deactivation, and the
// administrator appointment rules (FR-040). History is never deleted; access is revoked by status.
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import {
  checkUnitPermission,
  requireUnitMember,
  requireUnitPermission,
  requireUser,
} from "./lib/authz";
import { conflict, forbidden, notFound } from "./lib/errors";
import { countActiveAdmins, inviteMember, normalizeRoles } from "./lib/members";
import { ADMIN_ROLE, canAssignRoles } from "./lib/permissions";
import { roleKeyValidator } from "./lib/validators";
import { notifyByPermission, notifyUser } from "./notifications";

export const invite = mutation({
  args: { unitId: v.id("units"), email: v.string(), roles: v.array(roleKeyValidator) },
  handler: async (ctx, args) => {
    const { user, unit } = await requireUnitPermission(ctx, args.unitId, "members.manage");
    const membershipId = await inviteMember(ctx, {
      unitId: unit._id,
      email: args.email,
      roles: args.roles,
      invitedBy: user._id,
    });
    await notifyByPermission(ctx, {
      unitId: unit._id,
      permission: "members.manage",
      type: "membership.invited",
      title: "Invitation sent",
      body: `${user.displayName} invited a new member to ${unit.name}.`,
      link: "/operator/members",
    });
    return membershipId;
  },
});

// Only the person the invitation was issued to can accept it.
export const accept = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, { membershipId }) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db.get(membershipId);
    if (!membership || membership.userId !== user._id) throw notFound("Invitation");
    if (membership.status !== "invited") throw conflict("This invitation is no longer pending.");
    await ctx.db.patch(membershipId, { status: "active", updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId: membership.unitId,
      actorId: user._id,
      action: "membership.accept",
      entityType: "memberships",
      entityId: membershipId,
      before: { status: "invited" },
      after: { status: "active" },
    });
  },
});

export const setRoles = mutation({
  args: { membershipId: v.id("memberships"), roles: v.array(roleKeyValidator) },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw forbidden();
    const { user } = await requireUnitPermission(ctx, membership.unitId, "roles.manage");
    const roles = normalizeRoles(args.roles);
    if (!canAssignRoles(user._id, membership.userId, roles)) throw forbidden();

    const losesAdmin = membership.roles.includes(ADMIN_ROLE) && !roles.includes(ADMIN_ROLE);
    if (
      losesAdmin &&
      membership.status === "active" &&
      (await countActiveAdmins(ctx, membership.unitId, membership._id)) === 0
    ) {
      throw conflict("A unit must keep at least one administrator.");
    }

    await ctx.db.patch(membership._id, { roles, updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId: membership.unitId,
      actorId: user._id,
      action: "membership.set_roles",
      entityType: "memberships",
      entityId: membership._id,
      before: { roles: membership.roles },
      after: { roles },
    });
    await notifyUser(ctx, {
      unitId: membership.unitId,
      userId: membership.userId,
      type: "membership.roles_changed",
      title: "Your roles changed",
      body: "A unit administrator updated your roles.",
      link: "/",
    });
  },
});

// Deactivation revokes access but keeps the member, their history, and any outstanding
// assignments, so equipment stays accountable.
export const deactivate = mutation({
  args: { membershipId: v.id("memberships"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw forbidden();
    const { user } = await requireUnitPermission(ctx, membership.unitId, "members.manage");
    if (membership.userId === user._id) throw conflict("You cannot deactivate yourself.");
    if (membership.status === "inactive") throw conflict("This member is already inactive.");
    if (
      membership.status === "active" &&
      membership.roles.includes(ADMIN_ROLE) &&
      (await countActiveAdmins(ctx, membership.unitId, membership._id)) === 0
    ) {
      throw conflict("A unit must keep at least one administrator.");
    }
    const now = Date.now();
    await ctx.db.patch(membership._id, { status: "inactive", deactivatedAt: now, updatedAt: now });
    await appendAudit(ctx, {
      unitId: membership.unitId,
      actorId: user._id,
      action: "membership.deactivate",
      entityType: "memberships",
      entityId: membership._id,
      before: { status: membership.status },
      after: { status: "inactive" },
      reason: args.reason?.trim() || undefined,
    });
  },
});

// FR-040: another administrator appoints, or a platform administrator does so under an active
// support grant that an Officer or Logistics Officer of the unit verified.
export const appointAdmin = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, { membershipId }) => {
    const membership = await ctx.db.get(membershipId);
    if (!membership) throw forbidden();
    const check = await checkUnitPermission(ctx, membership.unitId, "roles.manage");
    const user = await requireUser(ctx);

    let reason: string;
    if (check.allowed) {
      if (membership.userId === user._id) throw forbidden();
      reason = "appointed by unit administrator";
    } else {
      if (!user.isPlatformAdmin) throw forbidden();
      const grants = await ctx.db
        .query("supportGrants")
        .withIndex("by_unit", (q) => q.eq("unitId", membership.unitId))
        .collect();
      const now = Date.now();
      const grant = grants.find(
        (candidate) => candidate.platformAdminId === user._id && candidate.expiresAt > now,
      );
      if (!grant) throw forbidden();
      reason = `support grant ${grant._id}`;
    }

    if (membership.status !== "active") throw conflict("Only active members can be appointed.");
    if (membership.roles.includes(ADMIN_ROLE))
      throw conflict("This member is already an administrator.");
    const roles = [...membership.roles, ADMIN_ROLE];
    await ctx.db.patch(membership._id, { roles, updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId: membership.unitId,
      actorId: user._id,
      action: "membership.appoint_admin",
      entityType: "memberships",
      entityId: membership._id,
      before: { roles: membership.roles },
      after: { roles },
      reason,
    });
    await notifyUser(ctx, {
      unitId: membership.unitId,
      userId: membership.userId,
      type: "membership.roles_changed",
      title: "You are now a unit administrator",
      body: "You were appointed as an administrator of your unit.",
      link: "/operator",
    });
  },
});

// Emails need members.manage; assignment counts need members.viewAssignments. Inactive members
// stay listed so their outstanding equipment remains visible.
export const list = query({
  args: { unitId: v.id("units"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { unitId, paginationOpts }) => {
    const { permissions } = await requireUnitMember(ctx, unitId);
    const canManage = permissions.has("members.manage");
    const canViewAssignments = permissions.has("members.viewAssignments");
    if (!canManage && !canViewAssignments) throw forbidden();

    const result = await ctx.db
      .query("memberships")
      .withIndex("by_unit_and_user", (q) => q.eq("unitId", unitId))
      .paginate(paginationOpts);

    const page = await Promise.all(
      result.page.map(async (membership) => {
        const profile = await ctx.db.get(membership.userId);
        let outstandingAssignments: number | undefined;
        if (canViewAssignments) {
          const assignments = await ctx.db
            .query("assignments")
            .withIndex("by_unit_and_member", (q) =>
              q.eq("unitId", unitId).eq("memberId", membership._id),
            )
            .collect();
          outstandingAssignments = assignments.filter((a) => a.status !== "closed").length;
        }
        return {
          membershipId: membership._id,
          userId: membership.userId,
          displayName: profile?.displayName ?? "Unknown",
          email: canManage ? (profile?.email ?? "") : undefined,
          roles: membership.roles,
          status: membership.status,
          outstandingAssignments,
        };
      }),
    );
    return { ...result, page };
  },
});
