import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { PUBLIC_ROUTE_PATTERNS, siteRedirect } from "@/lib/site-routing";

// /design-preview exists only outside production so the shell and shared components can be
// reviewed and tested without signing in.
const isPublicRoute = createRouteMatcher([
  ...PUBLIC_ROUTE_PATTERNS,
  ...(process.env.NODE_ENV !== "production" ? ["/design-preview"] : []),
]);

export default clerkMiddleware(async (auth, req) => {
  // Signed-in members never receive the public home page; they go straight to their portal.
  const { userId } = await auth();
  const redirectTo = siteRedirect(req.nextUrl.pathname, !!userId);
  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, req.url), 307);
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
