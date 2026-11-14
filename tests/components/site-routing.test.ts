import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTE_PATTERNS, siteRedirect } from "@/lib/site-routing";

describe("siteRedirect (FR-002)", () => {
  it("sends a signed-in member at the home page to the portal router", () => {
    expect(siteRedirect("/", true)).toBe("/portal");
  });

  it("lets signed-out visitors see the public home page", () => {
    expect(siteRedirect("/", false)).toBeNull();
  });

  it("only ever redirects the home page", () => {
    for (const path of ["/contact", "/terms", "/privacy", "/operator", "/portal", "/sign-in"]) {
      expect(siteRedirect(path, true)).toBeNull();
      expect(siteRedirect(path, false)).toBeNull();
    }
  });
});

describe("public route allow-list (FR-003)", () => {
  it("contains exactly the documented public routes", () => {
    expect([...PUBLIC_ROUTE_PATTERNS]).toEqual([
      "/",
      "/contact",
      "/terms",
      "/privacy",
      "/sitemap.xml",
      "/robots.txt",
      "/opengraph-image(.*)",
      "/sign-in(.*)",
      "/sign-up(.*)",
    ]);
  });

  it("never opens an authenticated area", () => {
    const patterns: readonly string[] = PUBLIC_ROUTE_PATTERNS;
    for (const path of [
      "/portal",
      "/operator",
      "/self-service",
      "/platform",
      "/accept-invite",
      "/no-access",
    ]) {
      expect(patterns.some((pattern) => pattern === path || pattern.startsWith(`${path}(`))).toBe(
        false,
      );
    }
  });
});
