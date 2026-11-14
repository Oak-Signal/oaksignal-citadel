import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// FR-027: only the public pages are listed. No lastModified, so the file stays static.
const PUBLIC_PAGES = ["/", "/contact", "/terms", "/privacy"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteUrl();
  return PUBLIC_PAGES.map((path) => ({
    url: path === "/" ? `${origin}/` : `${origin}${path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
