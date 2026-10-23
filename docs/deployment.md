# Deployment and release

## Architecture

- **Frontend:** Next.js on Vercel (preview per pull request, production from `main`).
- **Backend:** Convex. Separate development and production deployments (see [environments.md](./environments.md)).
- **Auth:** Clerk. Development instance now; a production instance is created before launch.

## Release strategy

1. Work on short-lived changes merged into `main` by pull request.
2. CI (`.github/workflows/ci.yml`) must pass: secret scan, lint, typecheck, format check, tests, `npm audit`, build.
3. Vercel deploys previews for PRs and production from `main`. The production build runs `npx convex deploy --cmd "npm run build"` so schema and functions ship with the frontend.
4. Roll back by redeploying the previous Vercel deployment; Convex schema changes must stay backward compatible for one release.

## Manual setup (not automated; done in dashboards)

| Task                     | Steps                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel project (T070)    | Import `Oak-Signal/oaksignal-citadel`, framework Next.js, production branch `main`.                                                                |
| Convex production (T071) | Create the production deployment in the Convex dashboard; generate a production deploy key.                                                        |
| Variables (T072)         | Vercel: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`. Convex: `CLERK_JWT_ISSUER_DOMAIN`. |
| GitHub variables for CI  | Repository variables `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `NEXT_PUBLIC_CONVEX_URL` (publishable values only; the build needs them).             |
| Branch protection (T074) | Settings > Branches > `main`: require a PR, 1 approval, the `verify` check, and block force pushes.                                                |

No secrets are stored in the repository; `.env.local` is git-ignored and `scripts/scan-secrets.mjs` blocks commits and CI runs that contain them.
