// Contract tests for units, memberships, roles, and support grants (FR-001 to FR-009, FR-040).
import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  expectCode,
  identityFor,
  newTest,
  seedMembership,
  seedUnit,
  seedUser,
  type TestConvex,
} from "./setup";

async function world() {
  const t = newTest();
  const root = await seedUser(t, "root", { isPlatformAdmin: true });
  const unitA = await seedUnit(t, root, "unit-a");
  const unitB = await seedUnit(t, root, "unit-b");
  const adminA = await seedUser(t, "admin_a");
  const adminA2 = await seedUser(t, "admin_a2");
  const officerA = await seedUser(t, "officer_a");
  const cadetA = await seedUser(t, "cadet_a");
  const adminB = await seedUser(t, "admin_b");
  const adminAMembership = await seedMembership(t, unitA, adminA, { roles: ["unit_admin"] });
  const adminA2Membership = await seedMembership(t, unitA, adminA2, { roles: ["unit_admin"] });
  const officerMembership = await seedMembership(t, unitA, officerA, { roles: ["officer_staff"] });
  const cadetMembership = await seedMembership(t, unitA, cadetA, { roles: ["junior_cadet"] });
  await seedMembership(t, unitB, adminB, { roles: ["unit_admin"] });
  return {
    t,
    root,
    unitA,
    unitB,
    adminA,
    cadetA,
    adminAMembership,
    adminA2Membership,
    officerMembership,
    cadetMembership,
    asRoot: t.withIdentity(identityFor("root")),
    asAdminA: t.withIdentity(identityFor("admin_a")),
    asAdminA2: t.withIdentity(identityFor("admin_a2")),
    asOfficerA: t.withIdentity(identityFor("officer_a")),
    asCadetA: t.withIdentity(identityFor("cadet_a")),
    asAdminB: t.withIdentity(identityFor("admin_b")),
  };
}

async function auditActions(t: TestConvex) {
  const rows = await t.run(async (ctx) => ctx.db.query("auditLog").collect());
  return rows.map((row) => row.action);
}

describe("units.create (provisioning)", () => {
  const args = {
    name: "No. 1 Squadron",
    identifier: "sqn-1",
    firstAdminEmail: "Commander@Example.test",
    verificationNote: "Confirmed with the commanding officer by phone.",
    requestKey: "req-1",
  };

  it("is limited to platform administrators", async () => {
    const w = await world();
    await expectCode(w.asAdminA.mutation(api.units.create, args), "FORBIDDEN");
    await expectCode(w.t.mutation(api.units.create, args), "UNAUTHENTICATED");
  });

  it("creates an active unit with defaults and invites the first administrator", async () => {
    const w = await world();
    const unitId = await w.asRoot.mutation(api.units.create, args);
    const unit = await w.t.run(async (ctx) => ctx.db.get(unitId));
    expect(unit).toMatchObject({
      name: "No. 1 Squadron",
      identifier: "sqn-1",
      status: "active",
      settings: { defaultReturnDays: 14, retentionYears: 7 },
    });
    const members = await w.t.run(async (ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_unit_and_status", (q) => q.eq("unitId", unitId))
        .collect(),
    );
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ status: "invited", roles: ["unit_admin"] });
    const invitee = await w.t.run(async (ctx) => ctx.db.get(members[0].userId));
    expect(invitee?.email).toBe("commander@example.test");
    expect(await auditActions(w.t)).toEqual(
      expect.arrayContaining(["unit.create", "membership.invite"]),
    );
  });

  it("rejects duplicate identifiers and invalid input", async () => {
    const w = await world();
    await w.asRoot.mutation(api.units.create, args);
    await expectCode(
      w.asRoot.mutation(api.units.create, { ...args, requestKey: "req-2" }),
      "CONFLICT",
    );
    await expectCode(
      w.asRoot.mutation(api.units.create, { ...args, identifier: "Bad Id!", requestKey: "r3" }),
      "VALIDATION",
    );
    await expectCode(
      w.asRoot.mutation(api.units.create, {
        ...args,
        identifier: "sqn-2",
        firstAdminEmail: "nope",
        requestKey: "r4",
      }),
      "VALIDATION",
    );
    await expectCode(
      w.asRoot.mutation(api.units.create, {
        ...args,
        identifier: "sqn-3",
        verificationNote: "  ",
        requestKey: "r5",
      }),
      "VALIDATION",
    );
  });

  it("returns the original result for a repeated requestKey", async () => {
    const w = await world();
    const first = await w.asRoot.mutation(api.units.create, args);
    const second = await w.asRoot.mutation(api.units.create, args);
    expect(second).toBe(first);
    const units = await w.t.run(async (ctx) => ctx.db.query("units").collect());
    expect(units.filter((unit) => unit.identifier === "sqn-1")).toHaveLength(1);
  });

  it("activates the invited administrator automatically on first sign-in", async () => {
    const w = await world();
    const unitId = await w.asRoot.mutation(api.units.create, args);
    const asCommander = w.t.withIdentity({
      subject: "clerk_commander",
      name: "Commander",
      email: "commander@example.test",
    });
    await asCommander.mutation(api.users.syncCurrentUser, {});
    const after = await asCommander.query(api.access.myAccess, {});
    expect(after.state).toBe("active");
    expect(after.invitations).toHaveLength(0);
    expect(after.units[0]).toMatchObject({ unitId });
    expect(after.units[0].permissions).toContain("members.manage");
  });
});

describe("memberships.invite and accept", () => {
  it("requires members.manage in that unit", async () => {
    const w = await world();
    const args = { unitId: w.unitA, email: "new@example.test", roles: ["junior_cadet" as const] };
    await expectCode(w.asCadetA.mutation(api.memberships.invite, args), "FORBIDDEN");
    await expectCode(w.asOfficerA.mutation(api.memberships.invite, args), "FORBIDDEN");
    await expectCode(w.asAdminB.mutation(api.memberships.invite, args), "FORBIDDEN");
    await expectCode(w.t.mutation(api.memberships.invite, args), "UNAUTHENTICATED");
  });

  it("creates a pending membership, audits it, and notifies the unit administrators", async () => {
    const w = await world();
    const id = await w.asAdminA.mutation(api.memberships.invite, {
      unitId: w.unitA,
      email: "New@Example.test",
      roles: ["supply_cadet"],
    });
    const membership = await w.t.run(async (ctx) => ctx.db.get(id));
    expect(membership).toMatchObject({ status: "invited", roles: ["supply_cadet"] });
    expect(await auditActions(w.t)).toContain("membership.invite");
    const notes = await w.t.run(async (ctx) => ctx.db.query("notifications").collect());
    const recipients = notes.filter((note) => note.type === "membership.invited");
    expect(recipients).toHaveLength(2);
  });

  it("rejects duplicate invitations and members, and requires at least one valid role", async () => {
    const w = await world();
    const args = { unitId: w.unitA, email: "dup@example.test", roles: ["junior_cadet" as const] };
    await w.asAdminA.mutation(api.memberships.invite, args);
    await expectCode(w.asAdminA.mutation(api.memberships.invite, args), "CONFLICT");
    await expectCode(
      w.asAdminA.mutation(api.memberships.invite, { ...args, email: "cadet_a@example.test" }),
      "CONFLICT",
    );
    await expectCode(
      w.asAdminA.mutation(api.memberships.invite, { ...args, email: "x@example.test", roles: [] }),
      "VALIDATION",
    );
    await expectCode(
      w.asAdminA.mutation(api.memberships.invite, { ...args, email: "not-an-email" }),
      "VALIDATION",
    );
  });

  it("does not let an administrator invite themselves as administrator again", async () => {
    const w = await world();
    await expectCode(
      w.asAdminA.mutation(api.memberships.invite, {
        unitId: w.unitA,
        email: "admin_a@example.test",
        roles: ["unit_admin"],
      }),
      "CONFLICT",
    );
  });

  it("activates the invitation when the invited person signs in, and no one else can accept it", async () => {
    const w = await world();
    const id = await w.asAdminA.mutation(api.memberships.invite, {
      unitId: w.unitA,
      email: "cadet_new@example.test",
      roles: ["junior_cadet"],
    });
    const asNew = w.t.withIdentity({
      subject: "clerk_new",
      name: "New Cadet",
      email: "cadet_new@example.test",
    });
    expect((await w.t.run(async (ctx) => ctx.db.get(id)))?.status).toBe("invited");
    await expectCode(
      w.asCadetA.mutation(api.memberships.accept, { membershipId: id }),
      "NOT_FOUND",
    );
    await asNew.mutation(api.users.syncCurrentUser, {});
    const membership = await w.t.run(async (ctx) => ctx.db.get(id));
    expect(membership?.status).toBe("active");
    await expectCode(asNew.mutation(api.memberships.accept, { membershipId: id }), "CONFLICT");
    expect(await auditActions(w.t)).toContain("membership.accept");
  });

  it("moves an invitation to an existing profile whose email arrives later", async () => {
    const w = await world();
    const asLate = w.t.withIdentity({ subject: "clerk_late" });
    await asLate.mutation(api.users.syncCurrentUser, {});
    const id = await w.asAdminA.mutation(api.memberships.invite, {
      unitId: w.unitA,
      email: "late@example.test",
      roles: ["junior_cadet"],
    });
    await w.t.mutation(internal.users.applyVerifiedEmail, {
      subject: "clerk_late",
      email: "Late@Example.test",
    });
    const membership = await w.t.run(async (ctx) => ctx.db.get(id));
    expect(membership?.status).toBe("active");
    const users = await w.t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users.filter((user) => user.email === "late@example.test")).toHaveLength(1);
    const access = await asLate.query(api.access.myAccess, {});
    expect(access.state).toBe("active");
  });

  it("does not blank a stored email when a later token carries none", async () => {
    const w = await world();
    const asLate = w.t.withIdentity({ subject: "clerk_keep", email: "keep@example.test" });
    await asLate.mutation(api.users.syncCurrentUser, {});
    await w.t.withIdentity({ subject: "clerk_keep" }).mutation(api.users.syncCurrentUser, {});
    const me = await asLate.query(api.users.me, {});
    expect(me?.email).toBe("keep@example.test");
  });

  it("scopes the new member to the inviting unit only", async () => {
    const w = await world();
    await w.asAdminA.mutation(api.memberships.invite, {
      unitId: w.unitA,
      email: "scoped@example.test",
      roles: ["officer_staff"],
    });
    const asScoped = w.t.withIdentity({ subject: "clerk_scoped", email: "scoped@example.test" });
    await asScoped.mutation(api.users.syncCurrentUser, {});
    await expectCode(asScoped.query(api.units.get, { unitId: w.unitB }), "FORBIDDEN");
    expect((await asScoped.query(api.units.get, { unitId: w.unitA }))._id).toBe(w.unitA);
  });
});

describe("memberships.setRoles", () => {
  it("assigns multiple roles, audits, and notifies the member", async () => {
    const w = await world();
    await w.asAdminA.mutation(api.memberships.setRoles, {
      membershipId: w.cadetMembership,
      roles: ["junior_cadet", "supply_cadet"],
    });
    const membership = await w.t.run(async (ctx) => ctx.db.get(w.cadetMembership));
    expect(membership?.roles).toEqual(["junior_cadet", "supply_cadet"]);
    expect(await auditActions(w.t)).toContain("membership.set_roles");
    const notes = await w.t.run(async (ctx) => ctx.db.query("notifications").collect());
    expect(
      notes.some((note) => note.type === "membership.roles_changed" && note.userId === w.cadetA),
    ).toBe(true);
  });

  it("requires roles.manage and stays within the member's unit", async () => {
    const w = await world();
    const args = { membershipId: w.cadetMembership, roles: ["senior_cadet" as const] };
    await expectCode(w.asCadetA.mutation(api.memberships.setRoles, args), "FORBIDDEN");
    await expectCode(w.asOfficerA.mutation(api.memberships.setRoles, args), "FORBIDDEN");
    await expectCode(w.asAdminB.mutation(api.memberships.setRoles, args), "FORBIDDEN");
  });

  it("prevents a user granting themselves the administrator role", async () => {
    const w = await world();
    const extraAdmin = await seedUser(w.t, "mgr");
    const managerMembership = await seedMembership(w.t, w.unitA, extraAdmin, {
      roles: ["logistics_officer"],
      extraPermissions: ["roles.manage"],
    });
    await expectCode(
      w.t.withIdentity(identityFor("mgr")).mutation(api.memberships.setRoles, {
        membershipId: managerMembership,
        roles: ["logistics_officer", "unit_admin"],
      }),
      "FORBIDDEN",
    );
  });

  it("prevents removing the last administrator", async () => {
    const w = await world();
    await w.asAdminA.mutation(api.memberships.setRoles, {
      membershipId: w.adminA2Membership,
      roles: ["officer_staff"],
    });
    await expectCode(
      w.asAdminA.mutation(api.memberships.setRoles, {
        membershipId: w.adminAMembership,
        roles: ["officer_staff"],
      }),
      "CONFLICT",
    );
  });

  it("rejects empty role lists", async () => {
    const w = await world();
    await expectCode(
      w.asAdminA.mutation(api.memberships.setRoles, { membershipId: w.cadetMembership, roles: [] }),
      "VALIDATION",
    );
  });
});

describe("memberships.deactivate", () => {
  it("deactivates without deleting history, and revokes access", async () => {
    const w = await world();
    await w.asAdminA.mutation(api.memberships.deactivate, { membershipId: w.cadetMembership });
    const membership = await w.t.run(async (ctx) => ctx.db.get(w.cadetMembership));
    expect(membership).toMatchObject({ status: "inactive", roles: ["junior_cadet"] });
    expect(membership?.deactivatedAt).toBeTypeOf("number");
    await expectCode(w.asCadetA.query(api.units.get, { unitId: w.unitA }), "FORBIDDEN");
    expect(await auditActions(w.t)).toContain("membership.deactivate");
  });

  it("requires members.manage and cannot deactivate the last administrator or yourself", async () => {
    const w = await world();
    await expectCode(
      w.asCadetA.mutation(api.memberships.deactivate, { membershipId: w.cadetMembership }),
      "FORBIDDEN",
    );
    await expectCode(
      w.asAdminA.mutation(api.memberships.deactivate, { membershipId: w.adminAMembership }),
      "CONFLICT",
    );
    await w.asAdminA.mutation(api.memberships.deactivate, { membershipId: w.adminA2Membership });
    const lone = await seedUser(w.t, "lone");
    const loneMembership = await seedMembership(w.t, w.unitB, lone, { roles: ["officer_staff"] });
    await expectCode(
      w.asAdminA.mutation(api.memberships.deactivate, { membershipId: loneMembership }),
      "FORBIDDEN",
    );
  });

  it("keeps a deactivated member's outstanding assignments visible and accountable", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const now = Date.now();
      const transactionId = await ctx.db.insert("transactions", {
        unitId: w.unitA,
        type: "issue",
        memberId: w.cadetMembership,
        performedBy: w.adminA,
        requestKey: "seed-1",
        occurredAt: now,
      });
      await ctx.db.insert("assignments", {
        unitId: w.unitA,
        itemId: "item-1",
        memberId: w.cadetMembership,
        quantityIssued: 1,
        quantityReturned: 0,
        issuedAt: now,
        status: "open",
        issueTransactionId: transactionId,
      });
    });
    await w.asAdminA.mutation(api.memberships.deactivate, { membershipId: w.cadetMembership });

    const page = await w.asAdminA.query(api.memberships.list, {
      unitId: w.unitA,
      paginationOpts: { numItems: 50, cursor: null },
    });
    const row = page.page.find((item) => item.membershipId === w.cadetMembership);
    expect(row).toMatchObject({ status: "inactive", outstandingAssignments: 1 });
    const assignments = await w.t.run(async (ctx) => ctx.db.query("assignments").collect());
    expect(assignments).toHaveLength(1);
  });
});

describe("memberships.list", () => {
  it("is limited to the unit and to members.manage or members.viewAssignments", async () => {
    const w = await world();
    const page = await w.asAdminA.query(api.memberships.list, {
      unitId: w.unitA,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(page.page).toHaveLength(4);
    await expectCode(
      w.asCadetA.query(api.memberships.list, {
        unitId: w.unitA,
        paginationOpts: { numItems: 50, cursor: null },
      }),
      "FORBIDDEN",
    );
    await expectCode(
      w.asAdminB.query(api.memberships.list, {
        unitId: w.unitA,
        paginationOpts: { numItems: 50, cursor: null },
      }),
      "FORBIDDEN",
    );
  });

  it("hides email addresses from members who can only view assignments", async () => {
    const w = await world();
    const page = await w.asOfficerA.query(api.memberships.list, {
      unitId: w.unitA,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(page.page.every((row) => row.email === undefined)).toBe(true);
    const adminPage = await w.asAdminA.query(api.memberships.list, {
      unitId: w.unitA,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(adminPage.page.every((row) => typeof row.email === "string")).toBe(true);
  });
});

describe("supportGrants and memberships.appointAdmin (FR-040)", () => {
  async function grantFor(w: Awaited<ReturnType<typeof world>>, hours = 4) {
    return await w.asRoot.mutation(api.supportGrants.create, {
      unitId: w.unitA,
      verifierEmail: "officer_a@example.test",
      reason: "Unit administrator unavailable; verified by the unit officer.",
      durationHours: hours,
    });
  }

  it("creates grants only for platform administrators, verified by an officer or logistics officer", async () => {
    const w = await world();
    await expectCode(
      w.asAdminA.mutation(api.supportGrants.create, {
        unitId: w.unitA,
        verifierEmail: "officer_a@example.test",
        reason: "x",
        durationHours: 2,
      }),
      "FORBIDDEN",
    );
    // A cadet cannot verify.
    await expectCode(
      w.asRoot.mutation(api.supportGrants.create, {
        unitId: w.unitA,
        verifierEmail: "cadet_a@example.test",
        reason: "Needs verification",
        durationHours: 2,
      }),
      "FORBIDDEN",
    );
    // A verifier from another unit cannot verify.
    await expectCode(
      w.asRoot.mutation(api.supportGrants.create, {
        unitId: w.unitB,
        verifierEmail: "officer_a@example.test",
        reason: "Wrong unit",
        durationHours: 2,
      }),
      "FORBIDDEN",
    );
    const grantId = await grantFor(w);
    const grant = await w.t.run(async (ctx) => ctx.db.get(grantId));
    expect(grant?.verifiedByMembershipId).toBe(w.officerMembership);
    expect(grant!.expiresAt).toBeGreaterThan(Date.now());
    expect(await auditActions(w.t)).toContain("support_grant.create");
  });

  it("limits the grant duration and requires a reason", async () => {
    const w = await world();
    await expectCode(
      w.asRoot.mutation(api.supportGrants.create, {
        unitId: w.unitA,
        verifierEmail: "officer_a@example.test",
        reason: "ok",
        durationHours: 500,
      }),
      "VALIDATION",
    );
    await expectCode(
      w.asRoot.mutation(api.supportGrants.create, {
        unitId: w.unitA,
        verifierEmail: "officer_a@example.test",
        reason: " ",
        durationHours: 2,
      }),
      "VALIDATION",
    );
  });

  it("lets another administrator appoint an administrator, but not oneself", async () => {
    const w = await world();
    await w.asAdminA.mutation(api.memberships.appointAdmin, { membershipId: w.cadetMembership });
    const membership = await w.t.run(async (ctx) => ctx.db.get(w.cadetMembership));
    expect(membership?.roles).toContain("unit_admin");
    expect(await auditActions(w.t)).toContain("membership.appoint_admin");

    const lone = await seedUser(w.t, "mgr2");
    const loneMembership = await seedMembership(w.t, w.unitA, lone, {
      roles: ["officer_staff"],
      extraPermissions: ["roles.manage"],
    });
    await expectCode(
      w.t
        .withIdentity(identityFor("mgr2"))
        .mutation(api.memberships.appointAdmin, { membershipId: loneMembership }),
      "FORBIDDEN",
    );
  });

  it("rejects appointment by non-administrators and across units", async () => {
    const w = await world();
    await expectCode(
      w.asCadetA.mutation(api.memberships.appointAdmin, { membershipId: w.cadetMembership }),
      "FORBIDDEN",
    );
    await expectCode(
      w.asAdminB.mutation(api.memberships.appointAdmin, { membershipId: w.cadetMembership }),
      "FORBIDDEN",
    );
  });

  it("lets a platform administrator appoint only with an active verified support grant", async () => {
    const w = await world();
    await expectCode(
      w.asRoot.mutation(api.memberships.appointAdmin, { membershipId: w.cadetMembership }),
      "FORBIDDEN",
    );
    const grantId = await grantFor(w);
    await w.asRoot.mutation(api.memberships.appointAdmin, { membershipId: w.cadetMembership });
    const membership = await w.t.run(async (ctx) => ctx.db.get(w.cadetMembership));
    expect(membership?.roles).toContain("unit_admin");
    const rows = await w.t.run(async (ctx) => ctx.db.query("auditLog").collect());
    const entry = rows.find((row) => row.action === "membership.appoint_admin");
    expect(entry?.reason).toContain(String(grantId));

    // The grant does not extend to another unit's memberships.
    const other = await seedUser(w.t, "other_b");
    const otherMembership = await seedMembership(w.t, w.unitB, other, { roles: ["junior_cadet"] });
    await expectCode(
      w.asRoot.mutation(api.memberships.appointAdmin, { membershipId: otherMembership }),
      "FORBIDDEN",
    );
  });

  it("rejects an expired grant, and a platform administrator has no default unit access", async () => {
    const w = await world();
    const grantId = await grantFor(w);
    await w.t.run(async (ctx) => ctx.db.patch(grantId, { expiresAt: Date.now() - 1000 }));
    await expectCode(
      w.asRoot.mutation(api.memberships.appointAdmin, { membershipId: w.cadetMembership }),
      "FORBIDDEN",
    );
    await expectCode(w.asRoot.query(api.units.get, { unitId: w.unitA }), "FORBIDDEN");
    await expectCode(
      w.asRoot.query(api.memberships.list, {
        unitId: w.unitA,
        paginationOpts: { numItems: 10, cursor: null },
      }),
      "FORBIDDEN",
    );
  });

  it("lists and revokes a platform administrator's own grants", async () => {
    const w = await world();
    const grantId = await grantFor(w);
    const grants = await w.asRoot.query(api.supportGrants.listMine, {});
    expect(grants.map((grant) => grant.grantId)).toContain(grantId);
    await expectCode(w.asAdminA.query(api.supportGrants.listMine, {}), "FORBIDDEN");
    await w.asRoot.mutation(api.supportGrants.revoke, { grantId });
    expect(await w.asRoot.query(api.supportGrants.listMine, {})).toHaveLength(0);
    expect(await auditActions(w.t)).toContain("support_grant.revoke");
  });
});

describe("units.updateSettings", () => {
  const settings = {
    name: "Renamed Unit",
    defaultReturnDays: 21,
    retentionYears: 10,
    lowStockNotifications: false,
  };

  it("requires unit.settings, validates, and audits before and after", async () => {
    const w = await world();
    await expectCode(
      w.asOfficerA.mutation(api.units.updateSettings, { unitId: w.unitA, ...settings }),
      "FORBIDDEN",
    );
    await expectCode(
      w.asAdminB.mutation(api.units.updateSettings, { unitId: w.unitA, ...settings }),
      "FORBIDDEN",
    );
    await expectCode(
      w.asAdminA.mutation(api.units.updateSettings, {
        unitId: w.unitA,
        ...settings,
        defaultReturnDays: 0,
      }),
      "VALIDATION",
    );
    await w.asAdminA.mutation(api.units.updateSettings, { unitId: w.unitA, ...settings });
    const unit = await w.t.run(async (ctx) => ctx.db.get(w.unitA));
    expect(unit).toMatchObject({
      name: "Renamed Unit",
      settings: { defaultReturnDays: 21, retentionYears: 10, lowStockNotifications: false },
    });
    const rows = await w.t.run(async (ctx) => ctx.db.query("auditLog").collect());
    const entry = rows.find((row) => row.action === "unit.update_settings");
    expect(entry?.before).toMatchObject({ defaultReturnDays: 14 });
    expect(entry?.after).toMatchObject({ defaultReturnDays: 21 });
  });
});

describe("roles (unit-adjustable permissions)", () => {
  it("lists system roles with defaults and requires roles.manage", async () => {
    const w = await world();
    const roles = await w.asAdminA.query(api.roles.list, { unitId: w.unitA });
    expect(roles.map((role) => role.key)).toContain("supply_cadet");
    await expectCode(w.asOfficerA.query(api.roles.list, { unitId: w.unitA }), "FORBIDDEN");
    await expectCode(w.asAdminB.query(api.roles.list, { unitId: w.unitA }), "FORBIDDEN");
  });

  it("overrides a role's permissions for one unit only, audited, and applies them", async () => {
    const w = await world();
    await w.asAdminA.mutation(api.roles.update, {
      unitId: w.unitA,
      key: "junior_cadet",
      permissions: ["requests.submit", "inventory.view"],
    });
    const access = await w.asCadetA.query(api.access.myAccess, {});
    expect(access.units[0].permissions).toContain("inventory.view");
    expect(await auditActions(w.t)).toContain("role.update");
    const other = await w.asAdminB.query(api.roles.list, { unitId: w.unitB });
    expect(other.find((role) => role.key === "junior_cadet")?.overridden).toBe(false);

    await w.asAdminA.mutation(api.roles.reset, { unitId: w.unitA, key: "junior_cadet" });
    const reset = await w.asCadetA.query(api.access.myAccess, {});
    expect(reset.units[0].permissions).not.toContain("inventory.view");
  });

  it("never lets the administrator role lose its management permissions", async () => {
    const w = await world();
    await expectCode(
      w.asAdminA.mutation(api.roles.update, {
        unitId: w.unitA,
        key: "unit_admin",
        permissions: ["inventory.view"],
      }),
      "CONFLICT",
    );
  });

  it("rejects unknown roles and unauthorised callers", async () => {
    const w = await world();
    await expectCode(
      w.asCadetA.mutation(api.roles.update, {
        unitId: w.unitA,
        key: "junior_cadet",
        permissions: ["inventory.view"],
      }),
      "FORBIDDEN",
    );
    await expectCode(
      w.asAdminA.mutation(api.roles.update, {
        unitId: w.unitA,
        key: "made_up",
        permissions: ["inventory.view"],
      }),
      "VALIDATION",
    );
  });
});

describe("access.myAccess (onboarding states)", () => {
  it("reports each state without exposing other units", async () => {
    const w = await world();
    const asNobody = w.t.withIdentity({ subject: "nobody", email: "nobody@example.test" });
    await asNobody.mutation(api.users.syncCurrentUser, {});
    expect((await asNobody.query(api.access.myAccess, {})).state).toBe("no_unit");

    const inactive = await seedUser(w.t, "gone");
    await seedMembership(w.t, w.unitA, inactive, { roles: ["junior_cadet"], status: "inactive" });
    const asGone = w.t.withIdentity(identityFor("gone"));
    expect((await asGone.query(api.access.myAccess, {})).state).toBe("inactive");

    const access = await w.asAdminA.query(api.access.myAccess, {});
    expect(access.state).toBe("active");
    expect(access.units.map((unit: { unitId: Id<"units"> }) => unit.unitId)).toEqual([w.unitA]);
  });

  it("returns a syncing state before the profile exists and is unavailable when signed out", async () => {
    const t = newTest();
    const asNew = t.withIdentity(identityFor("brand_new"));
    expect((await asNew.query(api.access.myAccess, {})).state).toBe("syncing");
    expect((await t.query(api.access.myAccess, {})).state).toBe("signed_out");
  });

  it("flags platform administrators", async () => {
    const w = await world();
    const access = await w.asRoot.query(api.access.myAccess, {});
    expect(access.isPlatformAdmin).toBe(true);
    expect(access.units).toEqual([]);
  });
});
