import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { expectCode, identityFor, newTest, seedMembership, seedUnit, seedUser } from "./setup";

const page = { numItems: 10, cursor: null };

describe("authorization matrix (fail closed)", () => {
  it("rejects unauthenticated callers", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    await expectCode(t.query(api.units.get, { unitId }), "UNAUTHENTICATED");
    await expectCode(t.query(api.audit.list, { unitId, paginationOpts: page }), "UNAUTHENTICATED");
  });

  it("rejects an identity with no profile", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const stranger = t.withIdentity(identityFor("no-profile"));
    await expectCode(stranger.query(api.units.get, { unitId }), "FORBIDDEN");
  });

  it("rejects an anonymized profile", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const anon = await seedUser(t, "anon", { anonymized: true });
    await seedMembership(t, unitId, anon, { roles: ["unit_admin"] });
    await expectCode(
      t.withIdentity(identityFor("anon")).query(api.units.get, { unitId }),
      "FORBIDDEN",
    );
  });

  it("rejects invited and inactive memberships", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const invited = await seedUser(t, "invited");
    const inactive = await seedUser(t, "inactive");
    await seedMembership(t, unitId, invited, { roles: ["unit_admin"], status: "invited" });
    await seedMembership(t, unitId, inactive, { roles: ["unit_admin"], status: "inactive" });
    await expectCode(
      t.withIdentity(identityFor("invited")).query(api.units.get, { unitId }),
      "FORBIDDEN",
    );
    await expectCode(
      t.withIdentity(identityFor("inactive")).query(api.units.get, { unitId }),
      "FORBIDDEN",
    );
  });

  it("rejects a user with no membership in the unit", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    await seedUser(t, "outsider");
    await expectCode(
      t.withIdentity(identityFor("outsider")).query(api.units.get, { unitId }),
      "FORBIDDEN",
    );
  });

  it("lets an active member read the unit but not data needing a missing permission", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const cadet = await seedUser(t, "cadet");
    await seedMembership(t, unitId, cadet, { roles: ["junior_cadet"] });
    const asCadet = t.withIdentity(identityFor("cadet"));
    const unit = await asCadet.query(api.units.get, { unitId });
    expect(unit._id).toBe(unitId);
    await expectCode(asCadet.query(api.audit.list, { unitId, paginationOpts: page }), "FORBIDDEN");
  });

  it("grants permissions from roles", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const admin = await seedUser(t, "admin");
    await seedMembership(t, unitId, admin, { roles: ["unit_admin"] });
    const result = await t
      .withIdentity(identityFor("admin"))
      .query(api.audit.list, { unitId, paginationOpts: page });
    expect(result.page).toEqual([]);
  });

  it("honours extra and revoked permissions", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const extra = await seedUser(t, "extra");
    const revoked = await seedUser(t, "revoked");
    await seedMembership(t, unitId, extra, {
      roles: ["junior_cadet"],
      extraPermissions: ["audit.view"],
    });
    await seedMembership(t, unitId, revoked, {
      roles: ["unit_admin"],
      revokedPermissions: ["audit.view"],
    });
    const withExtra = await t
      .withIdentity(identityFor("extra"))
      .query(api.audit.list, { unitId, paginationOpts: page });
    expect(withExtra.page).toEqual([]);
    await expectCode(
      t
        .withIdentity(identityFor("revoked"))
        .query(api.audit.list, { unitId, paginationOpts: page }),
      "FORBIDDEN",
    );
  });

  it("applies unit role definitions over system defaults", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const cadet = await seedUser(t, "cadet");
    await seedMembership(t, unitId, cadet, { roles: ["junior_cadet"] });
    await t.run(async (ctx) => {
      await ctx.db.insert("roleDefinitions", {
        unitId,
        key: "junior_cadet",
        name: "Junior Cadet",
        permissions: ["audit.view"],
      });
    });
    const result = await t
      .withIdentity(identityFor("cadet"))
      .query(api.audit.list, { unitId, paginationOpts: page });
    expect(result.page).toEqual([]);
  });

  it("restricts platform administration to platform admins", async () => {
    const t = newTest();
    await seedUser(t, "regular");
    await seedUser(t, "root", { isPlatformAdmin: true });
    const { requirePlatformAdmin } = await import("../../convex/lib/authz");
    await expectCode(
      t.withIdentity(identityFor("regular")).run((ctx) => requirePlatformAdmin(ctx)),
      "FORBIDDEN",
    );
    await expectCode(
      t.run((ctx) => requirePlatformAdmin(ctx)),
      "UNAUTHENTICATED",
    );
    const admin = await t.withIdentity(identityFor("root")).run((ctx) => requirePlatformAdmin(ctx));
    expect(admin.isPlatformAdmin).toBe(true);
  });
});
