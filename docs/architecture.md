# Architecture

## Modules

| Area               | Location             | Responsibility                                                                               |
| ------------------ | -------------------- | -------------------------------------------------------------------------------------------- |
| Public routes      | `app/(site)/`        | Public marketing site (`/`, `/contact`, `/terms`, `/privacy`). Static; no providers.         |
| App routes         | `app/(app)/`         | Signed-in portals, sign-in, onboarding pages, and the Clerk/Convex providers.                |
| Shared UI          | `components/shared/` | App shell, data table, forms, states, permission gate.                                       |
| Public-site UI     | `components/site/`   | Header, footer, hero, home sections, legal layout. Never imports Convex or Clerk.            |
| Primitives         | `components/ui/`     | shadcn/ui components (generated; edit sparingly).                                            |
| Client utilities   | `lib/`               | Validation (Zod), errors, types, formatting, CSV, permission helpers, public-site content.   |
| Backend            | `convex/`            | Schema, queries, mutations. All authorization and rules live here.                           |
| Backend foundation | `convex/lib/`        | `authz`, `permissions`, `audit`, `errors`, `logger`, `validators`, `mutations`, `lifecycle`. |

Boundaries: the client never decides access; it only hides controls. `lib/` must not import from `convex/` server code except generated API types. `convex/lib/permissions.ts` is the single permission catalogue.

## Public site and route groups

`app/` has two root layouts, one per route group. URLs never include the group name.

- `app/(site)/layout.tsx`: the public site. It mounts **no** Clerk, Convex, or access providers, so every public page prerenders as static HTML and cannot read unit data or call a server function. `tests/components/site-isolation.test.ts` fails if a file under `app/(site)/`, `components/site/`, or `lib/site-*.ts` imports Convex, Clerk, or the access providers.
- `app/(app)/layout.tsx`: everything else (portals, `/portal`, sign-in, onboarding). It wraps pages in `ClerkProvider` and `ConvexClientProvider`, and sends `noindex`.
- Moving between the two layouts is a full page load (for example from `/` to `/sign-in`), so public links to sign-in use `prefetch={false}`.
- `app/global-not-found.tsx` (enabled by `experimental.globalNotFound`) is the 404 for URLs that match neither group. `app/sitemap.ts` and `app/robots.ts` list only the public pages.
- Public copy that depends on the product's state (feature status, FAQ, links, contact) lives in `lib/site-content.ts`. Change a feature's status there when it ships.

### Routing at the edge

`proxy.ts` (Clerk middleware) runs before every page:

1. A signed-in request for `/` is redirected (307) to `/portal`, so members never receive marketing HTML. `/portal` waits for the member's access and sends them to `/self-service`, `/operator`, `/platform`, `/accept-invite`, or `/no-access` using `defaultPath` in `lib/portal.ts`.
2. Paths in `PUBLIC_ROUTE_PATTERNS` (`lib/site-routing.ts`) pass through without sign-in.
3. Everything else, including unknown paths, calls `auth.protect()` and sends a signed-out visitor to sign-in. The allow-list is fail-closed: a new page is protected unless it is added there deliberately.

## Request flow

Clerk authenticates the user, Convex receives the Clerk JWT, `requireUnitPermission` resolves identity, profile, active membership, and permission, then the function reads or writes using `by_unit...` indexes and calls `appendAudit()` for changes.

## Portals

`lib/types.ts` defines three portals (`self-service`, `operator`, `platform`). Each has its own navigation config in `components/shared/nav-config.ts`, rendered by `AppShell`; links are filtered by permission. Operator links carry a `group` (sidebar section and dashboard card), an optional `description`, optional `children` (sub-pages shown while their section is current), and `available: false` to hide a link until its page is built. The dashboards read the same config through `visibleNavItems` and `groupNavItems`, so a new page is added in one place.

## Development patterns

- New unit-owned table: include `unitId`, a `by_unit...` index, validators, and lifecycle fields.
- New function: validate args, call `requireUnitPermission` first, use `runIdempotent` for retried writes, call `appendAudit`, add tests in `tests/convex/`.
- New screen: wrap in `AppShell`, use `PageHeader`, the standard Loading/Empty/Error states, and `PermissionGate`.
- New public page: add it under `app/(site)/`, export metadata with `pageMetadata()` from `lib/site-metadata.ts`, add its path to `PUBLIC_ROUTE_PATTERNS`, `app/sitemap.ts`, and `app/robots.ts`, and cover it in `tests/e2e/us8-public-site.spec.ts`.
- Run `npm run lint`, `typecheck`, `test`, and `test:e2e` before opening a PR.
