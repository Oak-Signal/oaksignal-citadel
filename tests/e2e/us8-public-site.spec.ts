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
    // Sign-in is a full page load into the other root layout; in dev it may compile first.
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 20_000 });
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
    // The phone menu is interactive only after hydration.
    await page.waitForLoadState("networkidle");
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

test.describe("home page sections (US3)", () => {
  const SECTIONS = [
    { link: "Features", id: "features" },
    { link: "How it works", id: "how-it-works" },
    { link: "FAQ", id: "faq" },
  ] as const;

  for (const { link, id } of SECTIONS) {
    test(`header ${link} brings #${id} into view in at most two interactions`, async ({
      page,
      viewport,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const narrow = (viewport?.width ?? 1280) < 768;
      if (narrow) {
        await page.getByRole("button", { name: "Open menu" }).click();
        await page.getByRole("dialog").getByRole("link", { name: link }).click();
        await expect(page.getByRole("dialog")).toBeHidden();
      } else {
        await page.getByRole("banner").getByRole("link", { name: link }).click();
      }
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`section#${id}`)).toBeInViewport();
    });
  }

  // The same link from /contact is checked in the contact page tests below.
  test("footer FAQ link leads to the FAQ section", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "FAQ" })
      .click();
    await expect(page).toHaveURL(/\/#faq$/);
    await expect(page.locator("section#faq")).toBeInViewport();
  });

  test("an FAQ answer opens with the keyboard", async ({ page }) => {
    await page.goto("/");
    // The accordion is interactive only after hydration.
    await page.waitForLoadState("networkidle");
    const trigger = page.locator("section#faq").getByRole("button").first();
    await trigger.focus();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test("the complete home page has no WCAG A/AA violations, with an answer open", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const first = page.locator("section#faq").getByRole("button").first();
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("contact page (US4)", () => {
  test("header Contact reaches /contact in at most two interactions", async ({
    page,
    viewport,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    if ((viewport?.width ?? 1280) < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Contact", exact: true }).click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: "Contact", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  });

  test("footer Contact reaches /contact", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "Contact", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  });

  test("hero Get your unit started reaches /contact", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("main")
      .getByRole("link", { name: "Get your unit started" })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  });

  test("shows the email and private security guidance", async ({ page }) => {
    await page.goto("/contact");
    const mail = page.getByRole("main").getByRole("link", { name: "contact.oaksignal@gmail.com" });
    await expect(mail.first()).toHaveAttribute("href", "mailto:contact.oaksignal@gmail.com");
    await expect(page.getByRole("region", { name: "Report a security concern" })).toContainText(
      /privately/i,
    );
  });

  test("footer FAQ link from /contact lands on /#faq", async ({ page }) => {
    await page.goto("/contact");
    await page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "FAQ" })
      .click();
    await expect(page).toHaveURL(/\/#faq$/);
    await expect(page.locator("section#faq")).toBeInViewport();
  });

  test("has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/contact");
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test("does not scroll horizontally, including at 360px", async ({ page }) => {
    await page.goto("/contact");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 360, height: 740 });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("makes no request to the data or authentication backends", async ({ page }) => {
    const backend: string[] = [];
    page.on("request", (request) => {
      if (isBackendRequest(request)) backend.push(request.url());
    });
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");
    expect(backend).toEqual([]);
  });
});

test.describe("legal pages (US5)", () => {
  for (const { link, path, heading } of [
    { link: "Terms of Service", path: "/terms", heading: "Terms of Service" },
    { link: "Privacy Policy", path: "/privacy", heading: "Privacy Policy" },
  ]) {
    test(`footer ${link} reaches ${path} in one click`, async ({ page }) => {
      await page.goto("/");
      await page
        .getByRole("navigation", { name: "Footer" })
        .getByRole("link", { name: link, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole("note")).toContainText(/draft/i);
    });

    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });

    test(`${path} does not scroll horizontally, including at 360px`, async ({ page }) => {
      await page.goto(path);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.setViewportSize({ width: 360, height: 740 });
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });

    test(`${path} makes no request to the data or authentication backends`, async ({ page }) => {
      const backend: string[] = [];
      page.on("request", (request) => {
        if (isBackendRequest(request)) backend.push(request.url());
      });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(backend).toEqual([]);
    });
  }
});

test.describe("crawling (FR-027)", () => {
  test("robots.txt allows the public pages and blocks every app area", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    for (const path of ["/", "/contact", "/terms", "/privacy"]) {
      expect(body).toMatch(new RegExp(`^Allow: ${path}$`, "m"));
    }
    for (const path of [
      "/portal",
      "/operator",
      "/self-service",
      "/platform",
      "/accept-invite",
      "/no-access",
      "/sign-in",
      "/sign-up",
      "/design-preview",
    ]) {
      expect(body).toMatch(new RegExp(`^Disallow: ${path}$`, "m"));
    }
    expect(body).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });

  test("sitemap.xml lists exactly the four public pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const locations = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );
    expect(locations).toEqual(["/", "/contact", "/terms", "/privacy"]);
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
