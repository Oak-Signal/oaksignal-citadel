# Unit onboarding and provisioning

How a new unit joins CITADEL, who can do what, and how mistakes are handled.

## Who can create a unit

Only a **Platform Administrator** can create a unit. Nobody else, including unit administrators,
can create or provision one. Platform administration is separate from unit roles: a Platform
Administrator has **no access to any unit's data** until a support grant is issued (see below).

The application never sets the Platform Administrator flag. Set `isPlatformAdmin` to `true` on a
person's row in the Convex dashboard (Data > `users`) after they have signed in once. Do this only
for trusted Oak Signal staff.

## Provisioning a unit

Platform > Provision a unit (`/platform/units/new`).

| Field                       | Rules                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| Unit name                   | Required, up to 120 characters                                                 |
| Unit identifier             | Required, unique, lowercase letters, digits and single hyphens, up to 40 chars |
| First administrator's email | Required, valid email address                                                  |
| How you verified the admin  | Required free text. Stored in the audit entry for the unit                     |

On submit, one transaction:

1. creates the unit as `active` with default settings (14-day return period, 7-year retention,
   low-stock notifications on),
2. creates a pending membership for the first administrator with the Unit Administrator role,
3. writes `unit.create` and `membership.invite` audit entries.

## Duplicate and rejected requests

- **Duplicate identifier:** rejected with a `CONFLICT` error. Nothing is created.
- **Invalid input** (bad identifier, bad email, empty note): rejected with `VALIDATION`, both in
  the form and on the server.
- **Double submit:** the form sends one `requestKey` per page load. Repeating the request returns
  the original unit and does not create a second one.
- **Non-platform-administrators:** rejected with `FORBIDDEN`.

## First-administrator verification

Before provisioning, confirm out of band that the named person is the right administrator, for
example by phoning the commanding officer on the unit's published number. Record how you verified
them in the form. Then:

1. The person signs in with **the email address you entered**. Their pending membership attaches
   to that sign-in automatically.
2. It is activated automatically, with no accept step, and they land in the Operator portal.

A pending invitation grants nothing until the signed-in owner of that email appears. The email must
be one Clerk has verified: it comes from the session token's `email` claim, or from a server-side
Clerk lookup (`users.syncFromClerk`, needs `CLERK_SECRET_KEY` in the Convex environment). The
activation is audited as `membership.accept`. Nobody can grant themselves the administrator role.

## Inviting members

Unit administrators (anyone with `members.manage`) invite people from Operator > Members. The
invitee signs in with the invited email and is activated straight away. Unit administrators are
notified of each pending invitation. An inactive member can be invited again; their history is
kept.

## Changing roles and leaving

- **Roles** are changed by someone with `roles.manage`. Members can hold several roles. The last
  active administrator cannot be removed or deactivated.
- **Deactivation** removes access immediately but keeps the member, their history and any
  outstanding assignments, so equipment stays accountable.

## Appointing a unit administrator (FR-040)

Either:

- another administrator of the unit (someone other than the person being appointed) appoints
  them from Operator > Members, or
- a Platform Administrator appoints them under an **active support grant**.

### Support grants

A Platform Administrator creates a grant on the Platform page. It names the unit, a reason, a
duration (1 to 72 hours) and a **verifier**: an active Officer Staff or Logistics Officer of that
unit, identified by email. The grant covers that unit only, expires on its own, and can be revoked.
Creating and revoking grants and every appointment made under one are audited.

## Onboarding states

After sign-in, `/` sends each person to the right place:

| State               | Where they go                                               |
| ------------------- | ----------------------------------------------------------- |
| Active, staff roles | `/operator`                                                 |
| Active, cadet roles | `/self-service`                                             |
| Pending invitation  | `/accept-invite`                                            |
| No unit or inactive | `/no-access` (a Platform Administrator goes to `/platform`) |
