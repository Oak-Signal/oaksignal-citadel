// Clerk JWT validation for Convex. The issuer domain is read from the Convex deployment
// environment (set CLERK_JWT_ISSUER_DOMAIN in the Convex dashboard); it is never hard-coded.
import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
