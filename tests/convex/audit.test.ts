import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { appendAudit } from "../../convex/lib/audit";
import { checkUnitPermission, recordPermissionDenied } from "../../convex/lib/authz";
import { identityFor, newTest, seedMembership, seedUnit, seedUser } from "./setup";

describe("audit trail", () => {
  it("appendAudit writes an entry with a timestamp in the caller's transaction", async () => {
    const t = newTest();
    const actor = await seedUser(t, "actor");
    const unitId = await seedUnit(t, actor);
    const id = await t.run(async (ctx) =>
      appendAudit(ctx, {
        unitId,
        actorId: actor,
        action: "item.create",
        entityType: "items",
        entityId: "item-1",
        after: { name: "Radio" },
      }),
    );
    const entry = await t.run(async (ctx) => ctx.db.get(id));
    expect(entry).toMatchObject({
      action: "item.create",
      entityId: "item-1",
      after: { name: "Radio" },
    });
    expect(typeof entry?.occurredAt).toBe("number");
  });

  it("an audit entry rolls back with the transaction that failed", async () => {
    const t = newTest();
    const actor = await seedUser(t, "actor");
    await expect(
      t.run(async (ctx) => {
        await appendAudit(ctx, { actorId: actor, action: "x", entityType: "x", entityId: "1" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const entries = await t.run(async (ctx) => ctx.db.query("auditLog").collect());
    expect(entries).toHaveLength(0);
  });

  it("audit.list is restricted to holders of audit.view", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const cadet = await seedUser(t, "cadet");
    await seedMembership(t, unitId, cadet, { roles: ["supply_cadet"] });
    await expect(
      t
        .withIdentity(identityFor("cadet"))
        .query(api.audit.list, { unitId, paginationOpts: { numItems: 5, cursor: null } }),
    ).rejects.toThrow();
  });

  it("audit.list filters by action and returns newest first", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const admin = await seedUser(t, "admin");
    await seedMembership(t, unitId, admin, { roles: ["unit_admin"] });
    await t.run(async (ctx) => {
      for (const [action, occurredAt] of [
        ["a", 1],
        ["b", 2],
        ["a", 3],
      ] as const) {
        await ctx.db.insert("auditLog", {
          unitId,
          actorId: admin,
          action,
          entityType: "x",
          entityId: "1",
          occurredAt,
        });
      }
    });
    const result = await t.withIdentity(identityFor("admin")).query(api.audit.list, {
      unitId,
      action: "a",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page.map((entry) => entry.occurredAt)).toEqual([3, 1]);
  });
});

describe("authentication and access events", () => {
  it("records sign-in when a profile is created and does not duplicate it on quick re-sync", async () => {
    const t = newTest();
    const asUser = t.withIdentity(identityFor("alice"));
    const first = await asUser.mutation(api.users.syncCurrentUser, {});
    const second = await asUser.mutation(api.users.syncCurrentUser, {});
    expect(second).toBe(first);
    const entries = await t.run(async (ctx) => ctx.db.query("auditLog").collect());
    expect(entries.map((entry) => entry.action)).toEqual(["auth.sign_in"]);
    expect(entries[0].actorId).toBe(first);
  });

  it("records sign-out for a known user", async () => {
    const t = newTest();
    const asUser = t.withIdentity(identityFor("alice"));
    await asUser.mutation(api.users.syncCurrentUser, {});
    await asUser.mutation(api.users.recordSignOut, {});
    const actions = (await t.run(async (ctx) => ctx.db.query("auditLog").collect())).map(
      (e) => e.action,
    );
    expect(actions).toEqual(["auth.sign_in", "auth.sign_out"]);
  });

  it("records permission-denied attempts through the non-throwing check", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const cadet = await seedUser(t, "cadet");
    await seedMembership(t, unitId, cadet, { roles: ["junior_cadet"] });
    await t.withIdentity(identityFor("cadet")).run(async (ctx) => {
      const check = await checkUnitPermission(ctx, unitId, "inventory.manage");
      expect(check.allowed).toBe(false);
      if (!check.allowed && check.userId) {
        await recordPermissionDenied(ctx, {
          userId: check.userId,
          unitId,
          permission: "inventory.manage",
        });
      }
    });
    const entries = await t.run(async (ctx) => ctx.db.query("auditLog").collect());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "auth.permission_denied",
      entityId: "inventory.manage",
      unitId,
      actorId: cadet,
    });
  });
});
