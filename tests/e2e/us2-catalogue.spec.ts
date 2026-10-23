import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const CATALOGUE_ROUTES = [
  "/operator/inventory",
  "/operator/inventory/example",
  "/operator/settings/categories",
];

test.describe("catalogue routes signed out (US2)", () => {
  for (const route of CATALOGUE_ROUTES) {
    test(`${route} requires sign-in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/sign-in/);
    });
  }
});

// Needs a signed-in Clerk test user with inventory.manage; backend rules are covered by
// tests/convex/items.test.ts and stock-files.test.ts.
test.describe("catalogue flow (needs Clerk test users)", () => {
  test.fixme("create, search, filter and archive an item", async ({ page }) => {
    await page.goto("/operator/settings/categories");
    await page.getByRole("button", { name: "Add category" }).click();
    await page.getByLabel("Category name").fill("Radios");
    await page.getByRole("button", { name: "Save category" }).click();

    await page.goto("/operator/inventory");
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByLabel("Name").fill("Field radio");
    await page.getByLabel("Asset tag").fill("RAD-001");
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText("RAD-001")).toBeVisible();

    await page.getByLabel(/search/i).fill("Field radio");
    await expect(page.getByText("RAD-001")).toBeVisible();

    await page.getByText("RAD-001").click();
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: /confirm|archive/i }).last().click();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
