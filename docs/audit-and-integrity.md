# Audit, logging, and data integrity

## Logging

`convex/lib/logger.ts` emits structured JSON lines with a level, message, and correlation fields. Keys that look sensitive (tokens, secrets, passwords, emails) are redacted. Never log secrets or personal data.

## Errors

`convex/lib/errors.ts` throws `ConvexError` with a `code` (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `UNAVAILABLE`) and a safe message. Errors never reveal whether another unit's data exists. The client maps them with `lib/errors.ts`.

## Audit log

`auditLog` is append-only: `unitId?`, `actorId`, `action`, `entityType`, `entityId`, `before?`, `after?`, `reason?`, `occurredAt`. Indexes: `by_unit_and_time`, `by_entity`, `by_actor`.

Conventions:

- `appendAudit(ctx, entry)` in `convex/lib/audit.ts` is the **only** writer. No code may patch or delete `auditLog` rows (enforced by `tests/convex/guard.test.ts`).
- Call it inside the same mutation as the change, so both commit or neither does.
- Action names are `domain.verb` (for example `auth.sign_in`, `auth.sign_out`, `auth.permission_denied`, `item.archive`).
- Record `before` and `after` for changes to business data; keep personal data out of them.
- Reading requires `audit.view` (`convex/audit.ts`).

Caveat: a thrown mutation rolls back everything it wrote, including audit entries. Permission-denied events are therefore recorded with `checkUnitPermission` plus `recordPermissionDenied` and an error result, not a thrown error.

## Integrity

- Convex validators on every table and argument; shared Zod schemas in `lib/validation.ts` for client forms.
- `convex/lib/mutations.ts` provides `requestKey` idempotency (unique per unit): repeating a request returns the original result.
- `convex/lib/lifecycle.ts` standardizes `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, and `archived` instead of hard deletes.
