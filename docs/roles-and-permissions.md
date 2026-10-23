# Roles and permissions

Source of truth: [`convex/lib/permissions.ts`](../convex/lib/permissions.ts). Roles attach to a **membership** (a user in a unit). Platform administration (`users.isPlatformAdmin`) is separate and never grants unit-level permissions; platform admins reach unit data only through a verified, expiring `supportGrants` record.

## Effective permissions

`effective = (union of role permissions + extraPermissions) - revokedPermissions`

A unit's `roleDefinitions` rows can override a system role's default permissions for that unit.

## Permission catalogue

`inventory.view`, `inventory.manage`, `inventory.adjust`, `items.restricted.approve`, `issuance.perform`, `requests.submit`, `requests.approve`, `members.viewAssignments`, `members.manage`, `roles.manage`, `locations.manage`, `maintenance.manage`, `stocktake.run`, `stocktake.reconcile`, `reports.view`, `reports.export`, `audit.view`, `unit.settings`.

## Default role mappings

| Role                    | Defaults                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Unit Administrator      | All unit-level permissions. Cannot assign the administrator role to themselves.                                                    |
| Junior Cadet            | `requests.submit`                                                                                                                  |
| Senior Cadet/Instructor | `inventory.view`, `requests.submit`                                                                                                |
| Supply Cadet            | `inventory.view`, `issuance.perform`, `requests.submit`, `members.viewAssignments`, `stocktake.run`                                |
| Civilian Staff          | Staff base set (inventory, issuance, requests, `members.viewAssignments`, locations, maintenance, `stocktake.run`, `reports.view`) |
| Officer Staff           | Staff base plus `items.restricted.approve`, `stocktake.reconcile`, `reports.export`                                                |
| Logistics Officer       | Everything except `members.manage`, `roles.manage`, `unit.settings`                                                                |

`members.viewAssignments` defaults to Supply Cadet, Civilian Staff, Officer Staff, and Logistics Officer.

## Enforcement

- Every unit-scoped function calls `requireUnitPermission(ctx, unitId, permission)` from `convex/lib/authz.ts`. It fails closed: unauthenticated, no profile, inactive membership, wrong unit, or a missing permission are all rejected with generic errors.
- `tests/convex/guard.test.ts` fails if an exported public function lacks an authorization call.
- The UI hides controls with `PermissionGate`, but this is a convenience only; the server is the control.
