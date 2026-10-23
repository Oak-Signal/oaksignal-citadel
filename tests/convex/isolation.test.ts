import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { expectCode, identityFor, newTest, seedMembership, seedUnit, seedUser } from "./setup";

const page = { numItems: 10, cursor: null };

async function twoUnits() {
  const t = newTest();
  const owner = await seedUser(t, "owner");
  const unitA = await seedUnit(t, owner, "unit-a");
  const unitB = await seedUnit(t, owner, "unit-b");
  const adminA = await seedUser(t, "admin-a");
  const adminB = await seedUser(t, "admin-b");
  await seedMembership(t, unitA, adminA, { roles: ["unit_admin"] });
  await seedMembership(t, unitB, adminB, { roles: ["unit_admin"] });
  return { t, unitA, unitB };
}

describe("unit isolation", () => {
  it("an administrator of unit A cannot read unit B", async () => {
    const { t, unitB } = await twoUnits();
    await expectCode(
      t.withIdentity(identityFor("admin-a")).query(api.units.get, { unitId: unitB }),
      "FORBIDDEN",
    );
  });

  it("supplying another unit's ID gives no audit access", async () => {
    const { t, unitB } = await twoUnits();
    await expectCode(
      t
        .withIdentity(identityFor("admin-a"))
        .query(api.audit.list, { unitId: unitB, paginationOpts: page }),
      "FORBIDDEN",
    );
  });

  it("audit reads return only the requested unit's entries", async () => {
    const { t, unitA, unitB } = await twoUnits();
    const actorId = await seedUser(t, "actor");
    await t.run(async (ctx) => {
      await ctx.db.insert("auditLog", {
        unitId: unitA,
        actorId,
        action: "a",
        entityType: "x",
        entityId: "1",
        occurredAt: 1,
      });
      await ctx.db.insert("auditLog", {
        unitId: unitB,
        actorId,
        action: "b",
        entityType: "x",
        entityId: "2",
        occurredAt: 2,
      });
    });
    const result = await t
      .withIdentity(identityFor("admin-a"))
      .query(api.audit.list, { unitId: unitA, paginationOpts: page });
    expect(result.page.map((entry) => entry.action)).toEqual(["a"]);
  });

  it("listMine returns only the caller's own units", async () => {
    const { t, unitA } = await twoUnits();
    const mine = await t.withIdentity(identityFor("admin-a")).query(api.units.listMine, {});
    expect(mine.map((entry) => entry.unit._id)).toEqual([unitA]);
  });

  it("direct calls cannot bypass checks: a signed-in user with no membership gets nothing", async () => {
    const { t, unitA, unitB } = await twoUnits();
    await seedUser(t, "drifter");
    const asDrifter = t.withIdentity(identityFor("drifter"));
    expect(await asDrifter.query(api.units.listMine, {})).toEqual([]);
    await expectCode(asDrifter.query(api.units.get, { unitId: unitA }), "FORBIDDEN");
    await expectCode(asDrifter.query(api.units.get, { unitId: unitB }), "FORBIDDEN");
  });

  it("a user in two units sees both and only their own memberships", async () => {
    const { t, unitA, unitB } = await twoUnits();
    const both = await seedUser(t, "both");
    await seedMembership(t, unitA, both, { roles: ["junior_cadet"] });
    await seedMembership(t, unitB, both, { roles: ["junior_cadet"], status: "inactive" });
    const mine = await t.withIdentity(identityFor("both")).query(api.units.listMine, {});
    expect(mine.map((entry) => entry.unit._id)).toEqual([unitA]);
  });
});
