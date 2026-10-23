import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { identityFor, newTest, seedUser } from "./setup";

describe("users.syncCurrentUser", () => {
  it("creates a profile from the Clerk identity", async () => {
    const t = newTest();
    const asAlice = t.withIdentity({
      subject: "clerk_alice",
      name: "Alice Smith",
      email: "alice@example.test",
    });
    await asAlice.mutation(api.users.syncCurrentUser, {});
    const me = await asAlice.query(api.users.me, {});
    expect(me).toMatchObject({
      displayName: "Alice Smith",
      email: "alice@example.test",
      isPlatformAdmin: false,
    });
  });

  it("never creates duplicates for the same identity", async () => {
    const t = newTest();
    const asAlice = t.withIdentity(identityFor("clerk_alice"));
    await Promise.all([
      asAlice.mutation(api.users.syncCurrentUser, {}),
      asAlice.mutation(api.users.syncCurrentUser, {}),
    ]);
    await asAlice.mutation(api.users.syncCurrentUser, {});
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });

  it("updates changed profile details and keeps platform admin unchanged", async () => {
    const t = newTest();
    await seedUser(t, "root", { isPlatformAdmin: true });
    const renamed = t.withIdentity({ subject: "root", name: "Renamed", email: "new@example.test" });
    await renamed.mutation(api.users.syncCurrentUser, {});
    const me = await renamed.query(api.users.me, {});
    expect(me).toMatchObject({
      displayName: "Renamed",
      email: "new@example.test",
      isPlatformAdmin: true,
    });
  });

  it("rejects unauthenticated sync and returns no profile from me", async () => {
    const t = newTest();
    await expect(t.mutation(api.users.syncCurrentUser, {})).rejects.toThrow();
    expect(await t.query(api.users.me, {})).toBeNull();
  });
});
