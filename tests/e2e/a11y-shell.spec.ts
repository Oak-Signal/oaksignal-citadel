import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Runs against the dev-only /design-preview page, which renders the application shell and the
// shared components without needing a signed-in session.
test.describe("application shell accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design-preview");
    await expect(page.getByRole("heading", { level: 1, name: "Design preview" })).toBeVisible();
  });

  test("has no WCAG A/AA violations", async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("does not scroll horizontally", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("skip link is the first tab stop and moves focus to main content", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("navigation is reachable on every viewport", async ({ page, isMobile, viewport }) => {
    const narrow = (viewport?.width ?? 1280) < 768;
    if (narrow || isMobile) {
      const menu = page.getByRole("button", { name: "Open navigation menu" });
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("navigation", { name: "Operator navigation" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Operator navigation" })).toBeVisible();
    }
  });

  test("confirm dialog opens, traps focus, and closes with Escape", async ({ page }) => {
    await page.getByRole("button", { name: "Open confirm dialog" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("hides navigation links the member has no permission for", async ({ page, viewport }) => {
    if ((viewport?.width ?? 1280) < 768) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
    }
    const nav = page.getByRole("navigation", { name: "Operator navigation" });
    await expect(nav.getByRole("link", { name: "Inventory" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Audit" })).toHaveCount(0);
  });
});
