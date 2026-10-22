# Environments

CITADEL uses separate development and production environments. They never share keys, data, or
deployments.

| Concern | Development                                          | Production                                          |
| ------- | ---------------------------------------------------- | --------------------------------------------------- |
| Convex  | `dev:trustworthy-cod-880` (project `citadel`)        | Separate production deployment (created later)      |
| Clerk   | Development instance (`pk_test_...` / `sk_test_...`) | Production instance (`pk_live_...` / `sk_live_...`) |
| Hosting | Local `npm run dev`, Vercel preview deployments      | Vercel production                                   |

## Variables

| Variable                            | Where it is set                            | Secret |
| ----------------------------------- | ------------------------------------------ | ------ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local`, Vercel                       | No     |
| `CLERK_SECRET_KEY`                  | `.env.local`, Vercel (server only)         | Yes    |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | `.env.local`, Vercel                       | No     |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | `.env.local`, Vercel                       | No     |
| `NEXT_PUBLIC_CONVEX_URL`            | `.env.local`, Vercel                       | No     |
| `CONVEX_DEPLOYMENT`                 | `.env.local` (CLI use only)                | No     |
| `CLERK_JWT_ISSUER_DOMAIN`           | `.env.local` and the Convex deployment env | No     |

`CLERK_JWT_ISSUER_DOMAIN` is the Clerk Frontend API URL for that environment. It must also be set on
each Convex deployment, because `convex/auth.config.ts` reads it there:

```powershell
npx convex env set CLERK_JWT_ISSUER_DOMAIN <frontend-api-url>
```

## Clerk and Convex connection

1. In the Clerk dashboard, activate the Convex integration (or create a JWT template named
   `convex`). The token audience must be `convex`, matching `applicationID` in
   `convex/auth.config.ts`.
2. Set `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment (above).
3. Run `npx convex dev` locally to push functions to the development deployment.

## Production

- Create a separate Convex production deployment and a Clerk production instance.
- Set the production values in Vercel and on the production Convex deployment. Deploy Convex
  functions with `npx convex deploy`.
- Never reuse development keys in production.

## Rules

- Real values live only in git-ignored `.env.local`, Vercel, and the Convex dashboard.
- `.env.example` lists names only.
- Rotate any secret that is pasted into chat, a ticket, or a commit.
