// Contract tests for received stock, adjustments, and item file uploads (US2, T100, T101).
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { expectCode, identityFor, newTest, seedItem, seedMembership, seedUnit, seedUser } from "./setup";

async function world() {
  const t = newTest();
  const root = await seedUser(t, "root");
  const unit = await seedUnit(t, root, "unit-a");
  const admin = await seedUser(t, "admin");
  const manager = await seedUser(t, "manager");
  const viewer = await seedUser(t, "viewer");
  await seedMembership(t, unit, admin, { roles: ["unit_admin"] });
  // Manages inventory but cannot adjust quantities.
  await seedMembership(t, unit, manager, {
    roles: ["civilian_staff"],
    revokedPermissions: ["inventory.adjust"],
  });
  await seedMembership(t, unit, viewer, { roles: ["senior_cadet"] });
  const bulk = await seedItem(t, unit, admin, {
    trackingMode: "bulk",
    quantityOnHand: 10,
    quantityAvailable: 6,
  });
  const serial = await seedItem(t, unit, admin);
  return {
    t,
    unit,
    bulk,
    serial,
    asAdmin: t.withIdentity(identityFor("admin")),
    asManager: t.withIdentity(identityFor("manager")),
    asViewer: t.withIdentity(identityFor("viewer")),
  };
}

async function quantities(w: Awaited<ReturnType<typeof world>>) {
  const item = await w.t.run(async (ctx) => ctx.db.get(w.bulk));
  return { onHand: item!.quantityOnHand, available: item!.quantityAvailable };
}

describe("transactions.receiveStock", () => {
  it("adds to both quantities, writes the ledger and audits", async () => {
    const w = await world();
    const result = await w.asManager.mutation(api.transactions.receiveStock, {
      unitId: w.unit,
      itemId: w.bulk,
      quantity: 5,
      requestKey: "r1",
    });
    expect(result.replayed).toBe(false);
    expect(await quantities(w)).toEqual({ onHand: 15, available: 11 });
    const history = await w.asAdmin.query(api.items.history, { itemId: w.bulk });
    expect(history.map((e) => e.kind).sort()).toEqual(["audit", "transaction"]);
  });

  it("is idempotent for a repeated request key", async () => {
    const w = await world();
    const args = { unitId: w.unit, itemId: w.bulk, quantity: 5, requestKey: "same" };
    await w.asAdmin.mutation(api.transactions.receiveStock, args);
    const again = await w.asAdmin.mutation(api.transactions.receiveStock, args);
    expect(again.replayed).toBe(true);
    expect(await quantities(w)).toEqual({ onHand: 15, available: 11 });
  });

  it("requires inventory.manage and rejects bad quantities and serialized items", async () => {
    const w = await world();
    const base = { unitId: w.unit, itemId: w.bulk, quantity: 1, requestKey: "k" };
    await expectCode(w.asViewer.mutation(api.transactions.receiveStock, base), "FORBIDDEN");
    await expectCode(
      w.asAdmin.mutation(api.transactions.receiveStock, { ...base, quantity: 0 }),
      "VALIDATION",
    );
    await expectCode(
      w.asAdmin.mutation(api.transactions.receiveStock, { ...base, quantity: 1.5 }),
      "VALIDATION",
    );
    await expectCode(
      w.asAdmin.mutation(api.transactions.receiveStock, { ...base, itemId: w.serial }),
      "VALIDATION",
    );
  });
});

describe("transactions.adjustStock", () => {
  const base = (w: Awaited<ReturnType<typeof world>>) => ({
    unitId: w.unit,
    itemId: w.bulk,
    delta: -2,
    reason: "Damaged in storage",
    requestKey: "a1",
  });

  it("requires inventory.adjust and a reason", async () => {
    const w = await world();
    await expectCode(w.asManager.mutation(api.transactions.adjustStock, base(w)), "FORBIDDEN");
    await expectCode(
      w.asAdmin.mutation(api.transactions.adjustStock, { ...base(w), reason: "  " }),
      "VALIDATION",
    );
  });

  it("applies the change, records the reason in the audit trail and keeps 0 <= available <= onHand", async () => {
    const w = await world();
    await w.asAdmin.mutation(api.transactions.adjustStock, base(w));
    expect(await quantities(w)).toEqual({ onHand: 8, available: 4 });
    const audits = await w.t.run(async (ctx) => ctx.db.query("auditLog").collect());
    expect(audits.find((a) => a.action === "stock.adjust")).toMatchObject({
      reason: "Damaged in storage",
      before: { quantityOnHand: 10, quantityAvailable: 6 },
      after: { quantityOnHand: 8, quantityAvailable: 4 },
    });
    // 4 available remain; removing 5 would cut into issued stock.
    await expectCode(
      w.asAdmin.mutation(api.transactions.adjustStock, { ...base(w), delta: -5, requestKey: "a2" }),
      "CONFLICT",
    );
    await expectCode(
      w.asAdmin.mutation(api.transactions.adjustStock, { ...base(w), delta: 0, requestKey: "a3" }),
      "VALIDATION",
    );
    expect(await quantities(w)).toEqual({ onHand: 8, available: 4 });
  });
});

describe("files", () => {
  it("issues upload URLs only to users with inventory.manage", async () => {
    const w = await world();
    const url = await w.asAdmin.mutation(api.files.generateUploadUrl, { unitId: w.unit });
    expect(typeof url).toBe("string");
    await expectCode(
      w.asViewer.mutation(api.files.generateUploadUrl, { unitId: w.unit }),
      "FORBIDDEN",
    );
  });

  it("accepts a valid image, rejects disallowed types, and audits", async () => {
    const w = await world();
    const png = await w.t.run(async (ctx) =>
      ctx.storage.store(new Blob(["x"], { type: "image/png" })),
    );
    await w.asAdmin.mutation(api.files.setItemImage, { itemId: w.serial, storageId: png });
    const detail = await w.asAdmin.query(api.items.get, { itemId: w.serial });
    expect(detail?.imageUrl).toBeTruthy();

    const exe = await w.t.run(async (ctx) =>
      ctx.storage.store(new Blob(["x"], { type: "application/x-msdownload" })),
    );
    await expectCode(
      w.asAdmin.mutation(api.files.addAttachment, { itemId: w.serial, storageId: exe, name: "a.exe" }),
      "VALIDATION",
    );
    const audits = await w.t.run(async (ctx) => ctx.db.query("auditLog").collect());
    expect(audits.map((a) => a.action)).toContain("item.image.set");
  });

  it("adds and removes attachments, and forbids viewers", async () => {
    const w = await world();
    const pdf = await w.t.run(async (ctx) =>
      ctx.storage.store(new Blob(["x"], { type: "application/pdf" })),
    );
    await expectCode(
      w.asViewer.mutation(api.files.addAttachment, { itemId: w.serial, storageId: pdf, name: "m.pdf" }),
      "FORBIDDEN",
    );
    await w.asAdmin.mutation(api.files.addAttachment, {
      itemId: w.serial,
      storageId: pdf,
      name: "manual.pdf",
    });
    expect((await w.asAdmin.query(api.items.get, { itemId: w.serial }))?.attachments).toHaveLength(1);
    await w.asAdmin.mutation(api.files.removeAttachment, { itemId: w.serial, storageId: pdf });
    expect((await w.asAdmin.query(api.items.get, { itemId: w.serial }))?.attachments).toHaveLength(0);
  });
});
