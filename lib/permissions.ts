// Client-side permission helpers. These only decide what to SHOW; the server enforces every
// permission again, so hiding a control is never the security boundary.
import {
  ROLE_LABELS,
  effectivePermissions,
  isRoleKey,
  type MembershipGrants,
  type Permission,
} from "@/convex/lib/permissions";

export function can(grants: MembershipGrants | undefined, permission: Permission): boolean {
  return grants ? effectivePermissions(grants).has(permission) : false;
}

export function canAny(grants: MembershipGrants | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(grants, permission));
}

export function roleLabel(role: string): string {
  return isRoleKey(role) ? ROLE_LABELS[role] : role;
}
