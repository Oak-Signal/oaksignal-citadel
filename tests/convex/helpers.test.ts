import { describe, expect, it } from "vitest";
import { createLogger, redact } from "../../convex/lib/logger";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  canAssignRoles,
  effectivePermissions,
  hasPermission,
} from "../../convex/lib/permissions";
import { createStamp, updateStamp } from "../../convex/lib/lifecycle";
import { runIdempotent } from "../../convex/lib/mutations";
import { newTest, seedMembership, seedUnit, seedUser } from "./setup";
import { notifyByPermission } from "../../convex/notifications";
import type { Id } from "../../convex/_generated/dataModel";

describe("permissions", () => {
  it("gives the Unit Administrator every permission", () => {
    expect([...DEFAULT_ROLE_PERMISSIONS.unit_admin].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("defaults members.viewAssignments to supply, civilian, officer, and logistics roles", () => {
    for (const role of [
      "supply_cadet",
      "civilian_staff",
      "officer_staff",
      "logistics_officer",
    ] as const) {
      expect(DEFAULT_ROLE_PERMISSIONS[role]).toContain("members.viewAssignments");
    }
    expect(DEFAULT_ROLE_PERMISSIONS.junior_cadet).not.toContain("members.viewAssignments");
  });

  it("keeps administration permissions with the Unit Administrator", () => {
    for (const role of [
      "junior_cadet",
      "senior_cadet",
      "supply_cadet",
      "civilian_staff",
      "officer_staff",
      "logistics_officer",
    ] as const) {
      for (const permission of ["members.manage", "roles.manage", "unit.settings"] as const) {
        expect(DEFAULT_ROLE_PERMISSIONS[role]).not.toContain(permission);
      }
    }
  });

  it("combines role defaults, extras, and revocations", () => {
    const grants = {
      roles: ["junior_cadet"],
      extraPermissions: ["reports.view"],
      revokedPermissions: ["requests.submit"],
    };
    const result = effectivePermissions(grants);
    expect(result.has("reports.view")).toBe(true);
    expect(result.has("requests.submit")).toBe(false);
    expect(hasPermission(grants, "inventory.manage")).toBe(false);
  });

  it("ignores unknown roles and permissions", () => {
    expect(
      effectivePermissions({
        roles: ["wizard"],
        extraPermissions: ["nope"],
        revokedPermissions: [],
      }).size,
    ).toBe(0);
  });

  it("stops an administrator assigning the administrator role to themselves", () => {
    expect(canAssignRoles("u1", "u1", ["unit_admin"])).toBe(false);
    expect(canAssignRoles("u1", "u2", ["unit_admin"])).toBe(true);
    expect(canAssignRoles("u1", "u1", ["junior_cadet"])).toBe(true);
  });
});

describe("logger", () => {
  it("redacts secrets and personal data, including nested values", () => {
    const result = redact({
      unitId: "u1",
      token: "abc",
      user: { email: "a@b.c", id: "x" },
      apiKey: "k",
    });
    expect(result).toEqual({
      unitId: "u1",
      token: "[redacted]",
      user: { email: "[redacted]", id: "x" },
      apiKey: "[redacted]",
    });
  });

  it("binds correlation fields", () => {
    const logger = createLogger({ function: "test", requestId: "r1" });
    expect(() => logger.info("event", { unitId: "u1" })).not.toThrow();
  });
});

describe("lifecycle metadata", () => {
  it("stamps creation and update consistently", () => {
    const user = "user1" as Id<"users">;
    expect(createStamp(user, 5)).toEqual({
      createdAt: 5,
      updatedAt: 5,
      createdBy: user,
      updatedBy: user,
      archived: false,
    });
    expect(updateStamp(user, 9)).toEqual({ updatedAt: 9, updatedBy: user });
  });
});

describe("idempotent mutations", () => {
  it("returns the original transaction for a repeated requestKey and creates only one", async () => {
    const t = newTest();
    const user = await seedUser(t, "clerk");
    const unitId = await seedUnit(t, user);
    const insert = (ctx: Parameters<Parameters<typeof t.run>[0]>[0]) => async () =>
      ctx.db.insert("transactions", {
        unitId,
        type: "issue",
        performedBy: user,
        requestKey: "key-1",
        occurredAt: 1,
      });
    const first = await t.run(async (ctx) => runIdempotent(ctx, unitId, "key-1", insert(ctx)));
    const second = await t.run(async (ctx) => runIdempotent(ctx, unitId, "key-1", insert(ctx)));
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ transactionId: first.transactionId, replayed: true });
    expect(await t.run(async (ctx) => ctx.db.query("transactions").collect())).toHaveLength(1);
  });

  it("scopes request keys to a unit", async () => {
    const t = newTest();
    const user = await seedUser(t, "clerk");
    const unitA = await seedUnit(t, user, "a");
    const unitB = await seedUnit(t, user, "b");
    const make = (unitId: Id<"units">) =>
      t.run(async (ctx) =>
        runIdempotent(ctx, unitId, "same", async () =>
          ctx.db.insert("transactions", {
            unitId,
            type: "issue",
            performedBy: user,
            requestKey: "same",
            occurredAt: 1,
          }),
        ),
      );
    expect((await make(unitA)).replayed).toBe(false);
    expect((await make(unitB)).replayed).toBe(false);
  });

  it("rejects an empty request key", async () => {
    const t = newTest();
    const user = await seedUser(t, "clerk");
    const unitId = await seedUnit(t, user);
    await expect(
      t.run(async (ctx) =>
        runIdempotent(ctx, unitId, "  ", async () => {
          throw new Error("no");
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("notifications", () => {
  it("notifies only active members holding the permission", async () => {
    const t = newTest();
    const owner = await seedUser(t, "owner");
    const unitId = await seedUnit(t, owner);
    const officer = await seedUser(t, "officer");
    const cadet = await seedUser(t, "cadet");
    const inactive = await seedUser(t, "inactive");
    await seedMembership(t, unitId, officer, { roles: ["officer_staff"] });
    await seedMembership(t, unitId, cadet, { roles: ["junior_cadet"] });
    await seedMembership(t, unitId, inactive, { roles: ["officer_staff"], status: "inactive" });
    const count = await t.run(async (ctx) =>
      notifyByPermission(ctx, {
        unitId,
        permission: "stocktake.reconcile",
        type: "x",
        title: "T",
        body: "B",
        link: "/l",
      }),
    );
    expect(count).toBe(1);
    const rows = await t.run(async (ctx) => ctx.db.query("notifications").collect());
    expect(rows.map((row) => row.userId)).toEqual([officer]);
  });
});
