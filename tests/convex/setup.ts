/// <reference types="vite/client" />
// Shared helpers for backend tests (Vitest with convex-test). Each test builds a fresh
// in-memory database with `newTest()` and seeds only what it needs.
import { convexTest } from "convex-test";
import { expect } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import type { AppErrorCode } from "../../convex/lib/errors";
import type { RoleKey, Permission } from "../../convex/lib/permissions";

const modules = import.meta.glob([
  "../../convex/**/*.ts",
  "../../convex/_generated/*.js",
  "!../../convex/**/*.d.ts",
]);

export function newTest() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof newTest>;

export function identityFor(subject: string) {
  return { subject, name: `User ${subject}`, email: `${subject}@example.test` };
}

export async function seedUser(
  t: TestConvex,
  subject: string,
  options: { isPlatformAdmin?: boolean; anonymized?: boolean } = {},
): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      clerkSubject: subject,
      displayName: `User ${subject}`,
      email: `${subject}@example.test`,
      isPlatformAdmin: options.isPlatformAdmin ?? false,
      anonymizedAt: options.anonymized ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
  });
}

export async function seedUnit(
  t: TestConvex,
  createdBy: Id<"users">,
  identifier = "unit-1",
): Promise<Id<"units">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("units", {
      name: `Unit ${identifier}`,
      identifier,
      status: "active",
      settings: { defaultReturnDays: 14, retentionYears: 7, lowStockNotifications: true },
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
  });
}

export async function seedMembership(
  t: TestConvex,
  unitId: Id<"units">,
  userId: Id<"users">,
  options: {
    roles?: RoleKey[];
    status?: "invited" | "active" | "inactive";
    extraPermissions?: Permission[];
    revokedPermissions?: Permission[];
  } = {},
): Promise<Id<"memberships">> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("memberships", {
      unitId,
      userId,
      roles: options.roles ?? [],
      extraPermissions: options.extraPermissions ?? [],
      revokedPermissions: options.revokedPermissions ?? [],
      status: options.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
  });
}

// Asserts that a call rejects with the given structured error code.
export async function expectCode(promise: Promise<unknown>, code: AppErrorCode) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error, `expected rejection with ${code}`).not.toBeNull();
  const data = (error as { data?: { code?: string } }).data;
  expect(data?.code).toBe(code);
}
