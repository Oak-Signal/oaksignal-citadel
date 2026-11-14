// Public site routing rules shared by proxy.ts and the tests.
//
// Fail-closed allow-list: only the patterns below can be opened without signing in. Every other
// path, including ones added later and unknown ones, is protected by Clerk in proxy.ts. Making a
// page public therefore always needs a deliberate change here.
export const PUBLIC_ROUTE_PATTERNS = [
  "/",
  "/contact",
  "/terms",
  "/privacy",
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
] as const;

// The only redirect the public site makes: a signed-in member opening the home page goes to
// /portal, which sends them on to the portal their roles allow. Returns null to continue.
export function siteRedirect(pathname: string, isSignedIn: boolean): string | null {
  return pathname === "/" && isSignedIn ? "/portal" : null;
}
