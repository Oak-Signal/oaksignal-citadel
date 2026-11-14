// Scheduled jobs. Internal only: nothing here is callable from the client.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import { appendAudit } from "./lib/audit";

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365.25 * DAY_MS;
// Bounds one run; the daily schedule works through any backlog.
const MAX_MEMBERSHIPS_PER_UNIT = 200;

function isExpired(membership: Doc<"memberships">, unit: Doc<"units">, now: number) {
  if (membership.status !== "inactive") return false;
  const leftAt = membership.deactivatedAt ?? membership.leftAt ?? membership.updatedAt;
  return now - leftAt >= unit.settings.retentionYears * YEAR_MS;
}

// FR-039: once every unit a person belonged to has passed its retention period, replace their
// name and email with an anonymized label. The user ID is kept, so transactions and audit
// entries stay attributable to the same (now anonymous) person.
export const anonymizeExpiredMembers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const units = await ctx.db.query("units").take(1000);
    const unitsById = new Map<Id<"units">, Doc<"units">>(units.map((unit) => [unit._id, unit]));
    const checked = new Set<Id<"users">>();
    let anonymized = 0;

    for (const unit of units) {
      const inactive = await ctx.db
        .query("memberships")
        .withIndex("by_unit_and_status", (q) => q.eq("unitId", unit._id).eq("status", "inactive"))
        .take(MAX_MEMBERSHIPS_PER_UNIT);

      for (const membership of inactive) {
        if (checked.has(membership.userId) || !isExpired(membership, unit, now)) continue;
        checked.add(membership.userId);

        const user = await ctx.db.get(membership.userId);
        if (!user || user.anonymizedAt !== undefined || user.isPlatformAdmin) continue;

        const all = await ctx.db
          .query("memberships")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .take(200);
        const allExpired = all.every((other) => {
          const otherUnit = unitsById.get(other.unitId);
          return otherUnit !== undefined && isExpired(other, otherUnit, now);
        });
        if (!allExpired) continue;

        const label = `Former member ${user._id.slice(-6)}`;
        await ctx.db.patch(user._id, {
          displayName: label,
          email: `anonymized-${user._id}@anonymized.invalid`,
          clerkSubject: `anonymized:${user._id}`,
          anonymizedAt: now,
          updatedAt: now,
        });
        await appendAudit(ctx, {
          unitId: unit._id,
          actorId: user._id,
          action: "member.anonymize",
          entityType: "users",
          entityId: user._id,
          after: { anonymizedAt: now },
          reason: `Retention period of ${unit.settings.retentionYears} years elapsed.`,
        });
        anonymized += 1;
      }
    }
    return { anonymized };
  },
});

const crons = cronJobs();
crons.daily(
  "anonymize expired members",
  { hourUTC: 3, minuteUTC: 0 },
  internal.crons.anonymizeExpiredMembers,
);

export default crons;
