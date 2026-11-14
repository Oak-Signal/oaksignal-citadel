// Absolute origin of the public site, used for metadataBase, the sitemap and robots.txt.
// Resolution order: NEXT_PUBLIC_SITE_URL, then the Vercel production URL, then local development.
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const url = configured || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}
