// Unit functions. Provisioning is a platform-administrator action; day-to-day settings belong to
// the unit's own administrators.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import {
  requirePlatformAdmin,
  requireUnitMember,
  requireUnitPermission,
  requireUser,
} from "./lib/authz";
import { conflict, validation } from "./lib/errors";
import { inviteMember, normalizeEmail } from "./lib/members";
import { assertRequestKey } from "./lib/mutations";
import { DEFAULT_UNIT_SETTINGS, assertValidSettings, requireText } from "./lib/validators";

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_IDENTIFIER_LENGTH = 40;
const MAX_UNIT_NAME_LENGTH = 120;

export const create = mutation({
  args: {
    name: v.string(),
    identifier: v.string(),
    firstAdminEmail: v.string(),
    verificationNote: v.string(),
    requestKey: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const requestKey = assertRequestKey(args.requestKey);

    // A repeated submission returns the original unit instead of creating a second one.
    const previous = await ctx.db
      .query("units")
      .withIndex("by_creator_and_requestKey", (q) =>
        q.eq("createdBy", admin._id).eq("requestKey", requestKey),
      )
      .unique();
    if (previous) return previous._id;

    const name = requireText(args.name, "Unit name", MAX_UNIT_NAME_LENGTH);
    const identifier = args.identifier.trim();
    if (identifier.length > MAX_IDENTIFIER_LENGTH || !IDENTIFIER_PATTERN.test(identifier)) {
      throw validation("Identifier may only use lowercase letters, digits and single hyphens.");
    }
    const email = normalizeEmail(args.firstAdminEmail);
    const verificationNote = requireText(args.verificationNote, "Verification note");

    const duplicate = await ctx.db
      .query("units")
      .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
      .unique();
    if (duplicate) throw conflict("A unit with this identifier already exists.");

    const now = Date.now();
    const unitId = await ctx.db.insert("units", {
      name,
      identifier,
      status: "active",
      settings: { ...DEFAULT_UNIT_SETTINGS },
      createdBy: admin._id,
      requestKey,
      createdAt: now,
      updatedAt: now,
    });
    await appendAudit(ctx, {
      unitId,
      actorId: admin._id,
      action: "unit.create",
      entityType: "units",
      entityId: unitId,
      after: { name, identifier },
      reason: verificationNote,
    });
    await inviteMember(ctx, {
      unitId,
      email,
      roles: ["unit_admin"],
      invitedBy: admin._id,
    });
    return unitId;
  },
});

// Platform administrators see which units exist, never their data.
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const units = await ctx.db.query("units").withIndex("by_status").take(200);
    return units.map((unit) => ({
      unitId: unit._id,
      name: unit.name,
      identifier: unit.identifier,
      status: unit.status,
    }));
  },
});

export const updateSettings = mutation({
  args: {
    unitId: v.id("units"),
    name: v.string(),
    defaultReturnDays: v.number(),
    retentionYears: v.number(),
    lowStockNotifications: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user, unit } = await requireUnitPermission(ctx, args.unitId, "unit.settings");
    const name = requireText(args.name, "Unit name", MAX_UNIT_NAME_LENGTH);
    assertValidSettings(args);
    const settings = {
      defaultReturnDays: args.defaultReturnDays,
      retentionYears: args.retentionYears,
      lowStockNotifications: args.lowStockNotifications,
    };
    await ctx.db.patch(unit._id, { name, settings, updatedAt: Date.now() });
    await appendAudit(ctx, {
      unitId: unit._id,
      actorId: user._id,
      action: "unit.update_settings",
      entityType: "units",
      entityId: unit._id,
      before: { name: unit.name, ...unit.settings },
      after: { name, ...settings },
    });
  },
});

export const get = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const { unit } = await requireUnitMember(ctx, unitId);
    return unit;
  },
});

// Only units where the caller has an active membership.
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const units = [];
    for (const membership of memberships) {
      if (membership.status !== "active") continue;
      const unit = await ctx.db.get(membership.unitId);
      if (unit) units.push({ unit, roles: membership.roles });
    }
    return units;
  },
});
