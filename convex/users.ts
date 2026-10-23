// Application profile functions.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireIdentity, requireUser } from "./lib/authz";

const SIGN_IN_AUDIT_INTERVAL_MS = 30 * 60 * 1000;

function profileFromIdentity(identity: {
  subject: string;
  name?: string;
  nickname?: string;
  email?: string;
}) {
  const email = identity.email ?? "";
  const displayName = identity.name ?? identity.nickname ?? (email.split("@")[0] || "User");
  return { displayName, email };
}

// Upserts the application profile from the verified Clerk identity. Safe to call repeatedly
// (one profile per Clerk subject). Never grants platform administration.
export const syncCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const now = Date.now();
    const profile = profileFromIdentity(identity);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", identity.subject))
      .unique();

    if (existing) {
      if (existing.anonymizedAt !== undefined) return existing._id;
      const shouldAuditSignIn =
        existing.lastSignInAt === undefined ||
        now - existing.lastSignInAt > SIGN_IN_AUDIT_INTERVAL_MS;
      await ctx.db.patch(existing._id, {
        ...profile,
        updatedAt: now,
        ...(shouldAuditSignIn ? { lastSignInAt: now } : {}),
      });
      if (shouldAuditSignIn) {
        await appendAudit(ctx, {
          actorId: existing._id,
          action: "auth.sign_in",
          entityType: "users",
          entityId: existing._id,
        });
      }
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkSubject: identity.subject,
      ...profile,
      isPlatformAdmin: false,
      lastSignInAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await appendAudit(ctx, {
      actorId: userId,
      action: "auth.sign_in",
      entityType: "users",
      entityId: userId,
      reason: "profile created",
    });
    return userId;
  },
});

// Called by the client just before Clerk signs the user out.
export const recordSignOut = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await appendAudit(ctx, {
      actorId: user._id,
      action: "auth.sign_out",
      entityType: "users",
      entityId: user._id,
    });
  },
});

// The signed-in user's profile, or null when signed out or not yet synced.
export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      displayName: v.string(),
      email: v.string(),
      isPlatformAdmin: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", identity.subject))
      .unique();
    if (!user || user.anonymizedAt !== undefined) return null;
    return {
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
    };
  },
});
