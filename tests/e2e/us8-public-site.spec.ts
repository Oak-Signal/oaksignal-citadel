import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Request } from "@playwright/test";

// Public landing page (feature 002). Runs signed out on the desktop, tablet, and phone projects.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Requests that would mean the public site is talking to the data or auth backends (SC-007).
// Matched on host, so bundle file names that merely contain "clerk" do not count.
function isBackendRequest(request: Request): boolean {
  const { hostname } = new URL(request.url());
  if (/\.convex\.(cloud|site)$/.test(hostname)) return true;
  const isClerk =
    /(^|\.)clerk\.accounts\.dev$/.test(hostname) ||
    /^clerk\./.test(hostname) ||
    hostname === "api.clerk.com";
  // A Clerk *development* instance answers the first visit with a top-level handshake redirect
  // from the proxy (reason "dev-browser-missing"). That is a navigation, not a call made by the
  // page, and production instances skip it for visitors without a session. Calls from page
  // scripts still count.
  return isClerk && !request.isNavigationRequest();
}

async function overflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("public home page, signed out (US1)", () => {
  test("shows the marketing page instead of sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: /CITADEL/ })).toBeVisible();
  });

  test("reaches sign-in in one interaction", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Sign in" }).first().click();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("Get your unit started leads to contact", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("main")
      .getByRole("link", { name: "Get your unit started" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test("has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test("does not scroll horizontally, including at 360px", async ({ page }) => {
    await page.goto("/");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 360, height: 740 });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("skip link is the first tab stop and moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("navigation is reachable on every viewport", async ({ page, viewport }) => {
    await page.goto("/");
    if ((viewport?.width ?? 1280) < 768) {
      const menu = page.getByRole("button", { name: "Open menu" });
      await menu.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Sign in" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(menu).toBeFocused();
    } else {
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
    }
  });

  test("makes no request to the data or authentication backends", async ({ page }) => {
    const backend: string[] = [];
    page.on("request", (request) => {
      if (isBackendRequest(request)) backend.push(request.url());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(backend).toEqual([]);
  });
});

// The proxy redirect for "/" is unit-tested in tests/components/site-routing.test.ts and the
// portal choice in tests/components/portal-routing.test.tsx. These end-to-end checks need
// signed-in Clerk test users, which are not set up for CI yet (same as us1-access.spec.ts).
test.describe("signed-in redirect (need Clerk test users)", () => {
  test.fixme("a cadet opening / lands in /self-service without seeing the marketing page", async () => {});
  test.fixme("an operator opening / lands in /operator without seeing the marketing page", async () => {});
  test.fixme("a platform administrator opening / lands in /platform", async () => {});
  test.fixme("an invited member opening / lands in /accept-invite", async () => {});
  test.fixme("a signed-in person with no membership opening / lands in /no-access", async () => {});
});
