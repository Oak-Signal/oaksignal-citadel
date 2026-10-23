# Architecture

## Modules

| Area               | Location             | Responsibility                                                                               |
| ------------------ | -------------------- | -------------------------------------------------------------------------------------------- |
| Routes             | `app/`               | Next.js App Router pages, layouts, providers. No business rules.                             |
| Shared UI          | `components/shared/` | App shell, data table, forms, states, permission gate.                                       |
| Primitives         | `components/ui/`     | shadcn/ui components (generated; edit sparingly).                                            |
| Client utilities   | `lib/`               | Validation (Zod), errors, types, formatting, CSV, permission helpers.                        |
| Backend            | `convex/`            | Schema, queries, mutations. All authorization and rules live here.                           |
| Backend foundation | `convex/lib/`        | `authz`, `permissions`, `audit`, `errors`, `logger`, `validators`, `mutations`, `lifecycle`. |

Boundaries: the client never decides access; it only hides controls. `lib/` must not import from `convex/` server code except generated API types. `convex/lib/permissions.ts` is the single permission catalogue.

## Request flow

Clerk authenticates the user, Convex receives the Clerk JWT, `requireUnitPermission` resolves identity, profile, active membership, and permission, then the function reads or writes using `by_unit...` indexes and calls `appendAudit()` for changes.

## Portals

`lib/types.ts` defines three portals (`self-service`, `operator`, `platform`). Each has its own navigation config in `components/shared/nav-config.ts`, rendered by `AppShell`; links are filtered by permission.

## Development patterns

- New unit-owned table: include `unitId`, a `by_unit...` index, validators, and lifecycle fields.
- New function: validate args, call `requireUnitPermission` first, use `runIdempotent` for retried writes, call `appendAudit`, add tests in `tests/convex/`.
- New screen: wrap in `AppShell`, use `PageHeader`, the standard Loading/Empty/Error states, and `PermissionGate`.
- Run `npm run lint`, `typecheck`, `test`, and `test:e2e` before opening a PR.
