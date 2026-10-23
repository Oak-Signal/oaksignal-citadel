// The signed-in user's own access summary, used to route them after sign-in and to filter the UI.
// It returns only the caller's data and tolerates a missing profile, so it is the one unit-aware
// read that does not call requireUser (see the guard allowlist).
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { loadRoleOverrides } from "./lib/members";
import { effectivePermissions } from "./lib/permissions";

type AccessState =
  "signed_out" | "syncing" | "no_unit" | "pending_invitation" | "inactive" | "active";

export const myAccess = query({
  args: {},
  handler: async (ctx) => {
    const empty = {
      isPlatformAdmin: false,
      units: [] as { unitId: Id<"units">; name: string; roles: string[]; permissions: string[] }[],
      invitations: [] as { membershipId: Id<"memberships">; unitName: string; roles: string[] }[],
    };
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { state: "signed_out" as AccessState, ...empty };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_subject", (q) => q.eq("clerkSubject", identity.subject))
      .unique();
    if (!user) return { state: "syncing" as AccessState, ...empty };
    if (user.anonymizedAt !== undefined) return { state: "no_unit" as AccessState, ...empty };

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const units = [];
    const invitations = [];
    let inactive = 0;
    for (const membership of memberships) {
      const unit = await ctx.db.get(membership.unitId);
      if (!unit) continue;
      if (membership.status === "active") {
        const overrides = await loadRoleOverrides(ctx, unit._id);
        units.push({
          unitId: unit._id,
          name: unit.name,
          roles: [...membership.roles],
          permissions: [...effectivePermissions(membership, overrides)],
        });
      } else if (membership.status === "invited") {
        invitations.push({
          membershipId: membership._id,
          unitName: unit.name,
          roles: [...membership.roles],
        });
      } else {
        inactive += 1;
      }
    }

    let state: AccessState = "no_unit";
    if (units.length > 0) state = "active";
    else if (invitations.length > 0) state = "pending_invitation";
    else if (inactive > 0) state = "inactive";

    return { state, isPlatformAdmin: user.isPlatformAdmin, units, invitations };
  },
});
