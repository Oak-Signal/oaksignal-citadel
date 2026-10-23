// Contract tests for the item catalogue and categories (US2, FR-012, FR-015).
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import {
  expectCode,
  identityFor,
  newTest,
  seedItem,
  seedMembership,
  seedUnit,
  seedUser,
} from "./setup";

async function world() {
  const t = newTest();
  const root = await seedUser(t, "root");
  const unitA = await seedUnit(t, root, "unit-a");
  const unitB = await seedUnit(t, root, "unit-b");
  const admin = await seedUser(t, "admin_a");
  const viewer = await seedUser(t, "viewer_a");
  const cadet = await seedUser(t, "cadet_a");
  const adminB = await seedUser(t, "admin_b");
  await seedMembership(t, unitA, admin, { roles: ["unit_admin"] });
  await seedMembership(t, unitA, viewer, { roles: ["senior_cadet"] });
  await seedMembership(t, unitA, cadet, { roles: ["junior_cadet"] });
  await seedMembership(t, unitB, adminB, { roles: ["unit_admin"] });
  const asAdmin = t.withIdentity(identityFor("admin_a"));
  const categoryId = await asAdmin.mutation(api.categories.create, {
    unitId: unitA,
    name: "Tents",
  });
  return {
    t,
    unitA,
    unitB,
    admin,
    categoryId,
    asAdmin,
    asViewer: t.withIdentity(identityFor("viewer_a")),
    asCadet: t.withIdentity(identityFor("cadet_a")),
    asAdminB: t.withIdentity(identityFor("admin_b")),
  };
}

type World = Awaited<ReturnType<typeof world>>;

const serialized = (w: World, overrides: Record<string, unknown> = {}) => ({
  unitId: w.unitA,
  name: "Radio",
  categoryId: w.categoryId,
  trackingMode: "serialized" as const,
  condition: "good" as const,
  assetTag: "AT-1",
  ...overrides,
});

const page = { numItems: 50, cursor: null };

describe("categories", () => {
  it("requires inventory.manage to change and inventory.view to list", async () => {
    const w = await world();
    await expectCode(
      w.asViewer.mutation(api.categories.create, { unitId: w.unitA, name: "X" }),
      "FORBIDDEN",
    );
    await expectCode(w.asCadet.query(api.categories.list, { unitId: w.unitA }), "FORBIDDEN");
    const list = await w.asViewer.query(api.categories.list, { unitId: w.unitA });
    expect(list.map((c) => c.name)).toEqual(["Tents"]);
  });

  it("rejects duplicate names and archives instead of deleting", async () => {
    const w = await world();
    await expectCode(
      w.asAdmin.mutation(api.categories.create, { unitId: w.unitA, name: "Tents" }),
      "CONFLICT",
    );
    await w.asAdmin.mutation(api.categories.archive, { categoryId: w.categoryId });
    expect(await w.asAdmin.query(api.categories.list, { unitId: w.unitA })).toHaveLength(0);
    const all = await w.asAdmin.query(api.categories.list, {
      unitId: w.unitA,
      includeArchived: true,
    });
    expect(all[0].archived).toBe(true);
  });

  it("validates custom attribute definitions", async () => {
    const w = await world();
    await expectCode(
      w.asAdmin.mutation(api.categories.create, {
        unitId: w.unitA,
        name: "Bad",
        customAttributeDefs: [{ key: "Bad Key", label: "x", type: "text", required: false }],
      }),
      "VALIDATION",
    );
    await expectCode(
      w.asAdmin.mutation(api.categories.create, {
        unitId: w.unitA,
        name: "Bad2",
        customAttributeDefs: [{ key: "size", label: "Size", type: "select", required: true }],
      }),
      "VALIDATION",
    );
  });
});

describe("items.create / update / archive", () => {
  it("requires inventory.manage", async () => {
    const w = await world();
    await expectCode(w.asViewer.mutation(api.items.create, serialized(w)), "FORBIDDEN");
    await expectCode(w.asAdminB.mutation(api.items.create, serialized(w)), "FORBIDDEN");
  });

  it("rejects a duplicate assetTag within a unit but allows it in another unit", async () => {
    const w = await world();
    await w.asAdmin.mutation(api.items.create, serialized(w));
    await expectCode(
      w.asAdmin.mutation(api.items.create, serialized(w, { name: "Other" })),
      "CONFLICT",
    );
    const categoryB = await w.asAdminB.mutation(api.categories.create, {
      unitId: w.unitB,
      name: "Tents",
    });
    await w.asAdminB.mutation(
      api.items.create,
      serialized(w, { unitId: w.unitB, categoryId: categoryB }),
    );
  });

  it("forces serialized items to quantity 1 and rejects other quantities", async () => {
    const w = await world();
    const id = await w.asAdmin.mutation(api.items.create, serialized(w));
    const item = await w.asAdmin.query(api.items.get, { itemId: id });
    expect(item).toMatchObject({ quantityOnHand: 1, quantityAvailable: 1 });
    await expectCode(
      w.asAdmin.mutation(
        api.items.create,
        serialized(w, { assetTag: "AT-2", quantityOnHand: 5 }),
      ),
      "VALIDATION",
    );
  });

  it("enforces 0 <= quantityAvailable <= quantityOnHand for bulk items", async () => {
    const w = await world();
    const bulk = { ...serialized(w), trackingMode: "bulk" as const, assetTag: undefined };
    await expectCode(
      w.asAdmin.mutation(api.items.create, { ...bulk, quantityOnHand: 5, quantityAvailable: 6 }),
      "VALIDATION",
    );
    await expectCode(
      w.asAdmin.mutation(api.items.create, { ...bulk, quantityOnHand: 5, quantityAvailable: -1 }),
      "VALIDATION",
    );
    await w.asAdmin.mutation(api.items.create, { ...bulk, quantityOnHand: 5, quantityAvailable: 5 });
  });

  it("audits create and update with before and after values", async () => {
    const w = await world();
    const id = await w.asAdmin.mutation(api.items.create, serialized(w));
    await w.asAdmin.mutation(api.items.update, { itemId: id, name: "Radio 2" });
    const audits = await w.t.run(async (ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_entity", (q) => q.eq("entityType", "items").eq("entityId", id))
        .collect(),
    );
    const update = audits.find((a) => a.action === "item.update");
    expect(audits.map((a) => a.action)).toContain("item.create");
    expect(update?.before).toMatchObject({ name: "Radio" });
    expect(update?.after).toMatchObject({ name: "Radio 2" });
  });

  it("validates custom attributes against the category", async () => {
    const w = await world();
    const categoryId = await w.asAdmin.mutation(api.categories.create, {
      unitId: w.unitA,
      name: "Boots",
      customAttributeDefs: [{ key: "size", label: "Size", type: "number", required: true }],
    });
    await expectCode(
      w.asAdmin.mutation(api.items.create, serialized(w, { categoryId, assetTag: "B-1" })),
      "VALIDATION",
    );
    await w.asAdmin.mutation(
      api.items.create,
      serialized(w, { categoryId, assetTag: "B-1", customAttributes: { size: 9 } }),
    );
  });

  it("archives and hides an item, but not while it is issued", async () => {
    const w = await world();
    const id = await w.asAdmin.mutation(api.items.create, serialized(w));
    await w.asAdmin.mutation(api.items.archive, { itemId: id });
    const list = await w.asAdmin.query(api.items.list, { unitId: w.unitA, paginationOpts: page });
    expect(list.page).toHaveLength(0);

    const issued = await seedItem(w.t, w.unitA, w.admin, { status: "issued" });
    await expectCode(w.asAdmin.mutation(api.items.archive, { itemId: issued }), "CONFLICT");
  });
});

describe("items.list / search / get / history", () => {
  it("is limited to the unit and to inventory.view", async () => {
    const w = await world();
    await w.asAdmin.mutation(api.items.create, serialized(w));
    const viewerList = await w.asViewer.query(api.items.list, {
      unitId: w.unitA,
      paginationOpts: page,
    });
    expect(viewerList.page).toHaveLength(1);
    await expectCode(
      w.asCadet.query(api.items.list, { unitId: w.unitA, paginationOpts: page }),
      "FORBIDDEN",
    );
    await expectCode(
      w.asAdminB.query(api.items.list, { unitId: w.unitA, paginationOpts: page }),
      "FORBIDDEN",
    );
  });

  it("filters by status, category and restricted, and sets the low-stock flag", async () => {
    const w = await world();
    await w.asAdmin.mutation(api.items.create, serialized(w, { status: "damaged" }));
    await w.asAdmin.mutation(api.items.create, {
      ...serialized(w),
      assetTag: undefined,
      name: "Rations",
      trackingMode: "bulk",
      quantityOnHand: 3,
      quantityAvailable: 3,
      minThreshold: 5,
      restricted: true,
    });
    const run = (extra: Record<string, unknown>) =>
      w.asAdmin.query(api.items.list, { unitId: w.unitA, paginationOpts: page, ...extra });
    expect((await run({ status: "damaged" })).page.map((i) => i.name)).toEqual(["Radio"]);
    expect((await run({ restricted: true })).page.map((i) => i.name)).toEqual(["Rations"]);
    expect((await run({ categoryId: w.categoryId })).page).toHaveLength(2);
    const rations = (await run({})).page.find((i) => i.name === "Rations");
    expect(rations?.lowStock).toBe(true);
    const radio = (await run({})).page.find((i) => i.name === "Radio");
    expect(radio?.lowStock).toBe(false);
  });

  it("finds items by name or asset tag within the unit only", async () => {
    const w = await world();
    await w.asAdmin.mutation(api.items.create, serialized(w, { name: "Field Radio" }));
    const byName = await w.asAdmin.query(api.items.search, { unitId: w.unitA, text: "Radio" });
    expect(byName).toHaveLength(1);
    const byTag = await w.asAdmin.query(api.items.search, { unitId: w.unitA, text: "AT-1" });
    expect(byTag).toHaveLength(1);
    await expectCode(
      w.asAdminB.query(api.items.search, { unitId: w.unitA, text: "Radio" }),
      "FORBIDDEN",
    );
  });

  it("returns item details and a merged history", async () => {
    const w = await world();
    const id = await w.asAdmin.mutation(api.items.create, serialized(w));
    await w.asAdmin.mutation(api.items.update, { itemId: id, condition: "fair" });
    const detail = await w.asViewer.query(api.items.get, { itemId: id });
    expect(detail).toMatchObject({ categoryName: "Tents", condition: "fair" });
    const history = await w.asViewer.query(api.items.history, { itemId: id });
    expect(history.map((entry) => entry.kind)).toEqual(["audit", "audit"]);
    await expectCode(w.asCadet.query(api.items.get, { itemId: id }), "FORBIDDEN");
  });
});
