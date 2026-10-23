// Application profile functions.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { appendAudit } from "./lib/audit";
import { requireIdentity, requireUser } from "./lib/authz";
import { PLACEHOLDER_PREFIX, attachInvites } from "./lib/members";

const SIGN_IN_AUDIT_INTERVAL_MS = 30 * 60 * 1000;

function profileFromIdentity(identity: {
  subject: string;
  name?: string;
  nickname?: string;
  email?: string;
}) {
  const email = (identity.email ?? "").trim().toLowerCase();
  const displayName = identity.name ?? identity.nickname ?? (email.split("@")[0] || "User");
  return { displayName, email };
}

// Fields to write for an existing profile. A token without an email or name must not blank out
// what an earlier sync or the Clerk server lookup already stored.
function updatesFor(
  existing: { displayName: string; email: string },
  profile: { displayName: string; email: string },
) {
  return {
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.displayName !== "User" || !existing.displayName
      ? { displayName: profile.displayName }
      : {}),
  };
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
        ...updatesFor(existing, profile),
        updatedAt: now,
        ...(shouldAuditSignIn ? { lastSignInAt: now } : {}),
      });
      await attachInvites(ctx, existing._id, profile.email || existing.email);
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

    // Claim the placeholder profile created when this email was invited, so pending
    // memberships attach to the real identity. Only placeholders are claimable.
    if (profile.email) {
      const placeholder = await ctx.db
        .query("users")
        .withIndex("by_clerk_subject", (q) =>
          q.eq("clerkSubject", `${PLACEHOLDER_PREFIX}${profile.email}`),
        )
        .unique();
      if (placeholder && placeholder.anonymizedAt === undefined) {
        await ctx.db.patch(placeholder._id, {
          clerkSubject: identity.subject,
          ...profile,
          lastSignInAt: now,
          updatedAt: now,
        });
        await attachInvites(ctx, placeholder._id, profile.email);
        await appendAudit(ctx, {
          actorId: placeholder._id,
          action: "auth.sign_in",
          entityType: "users",
          entityId: placeholder._id,
          reason: "invited profile claimed",
        });
        return placeholder._id;
      }
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

// Stores an email that Clerk's server has verified for this subject, then attaches invitations.
export const applyVerifiedEmail = internalMutation({
  args: { subject: v.string(), email: v.string(), displayName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", args.subject))
      .unique();
    if (!user || user.anonymizedAt !== undefined) return;
    const email = args.email.trim().toLowerCase();
    await ctx.db.patch(user._id, {
      email,
      ...(args.displayName && (user.displayName === "User" || !user.displayName)
        ? { displayName: args.displayName }
        : {}),
      updatedAt: Date.now(),
    });
    await attachInvites(ctx, user._id, email);
  },
});

type ClerkUser = {
  first_name?: string | null;
  last_name?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: {
    id: string;
    email_address: string;
    verification?: { status?: string } | null;
  }[];
};

// Looks up the signed-in user's verified primary email from the Clerk server API, so
// invitations attach even when the session token carries no email claim. Needs
// CLERK_SECRET_KEY in the Convex deployment environment; without it this does nothing.
export const syncFromClerk = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const secret = process.env.CLERK_SECRET_KEY;
    if (!identity || !secret) return { synced: false };
    const response = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(identity.subject)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!response.ok) return { synced: false };
    const clerkUser = (await response.json()) as ClerkUser;
    const primary = clerkUser.email_addresses?.find(
      (address) => address.id === clerkUser.primary_email_address_id,
    );
    if (!primary || primary.verification?.status !== "verified") return { synced: false };
    const displayName =
      [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || undefined;
    await ctx.runMutation(internal.users.applyVerifiedEmail, {
      subject: identity.subject,
      email: primary.email_address,
      displayName,
    });
    return { synced: true };
  },
});
