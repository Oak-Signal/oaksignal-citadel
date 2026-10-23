import { expect, test } from "@playwright/test";

// Routes that must never render for a signed-out visitor, including by direct URL entry.
const PROTECTED_ROUTES = [
  "/",
  "/self-service",
  "/operator",
  "/operator/members",
  "/operator/settings",
  "/operator/settings/roles",
  "/platform",
  "/platform/units/new",
  "/accept-invite",
  "/no-access",
];

test.describe("signed-out access (US1)", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} requires sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/sign-in/);
      await expect(page.getByText("secret")).toHaveCount(0);
    });
  }
});

// These flows need signed-in Clerk test users in two units. Until Clerk testing tokens are set
// up for CI they are tracked here, and the same rules are covered by tests/convex
// (units-memberships, isolation) and tests/components/portal-routing.test.tsx.
test.describe("role flows (need Clerk test users)", () => {
  test.fixme("Junior Cadet is blocked from /operator", async () => {});
  test.fixme("Supply Cadet cannot manage roles", async () => {});
  test.fixme("a member of unit A cannot reach unit B's data by direct URL", async () => {});
});
