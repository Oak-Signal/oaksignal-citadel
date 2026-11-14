import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// FR-027: search engines may list the public pages only. Signed-in areas also send
// `noindex` from app/(app)/layout.tsx, so this is a second layer, not the only one.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/contact", "/terms", "/privacy"],
      disallow: [
        "/portal",
        "/operator",
        "/self-service",
        "/platform",
        "/accept-invite",
        "/no-access",
        "/sign-in",
        "/sign-up",
        "/design-preview",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
