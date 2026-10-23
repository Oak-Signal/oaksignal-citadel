// Permission catalogue and default role-to-permission mappings.
// See docs/roles-and-permissions.md. Roles attach to unit memberships; platform administration
// (`users.isPlatformAdmin`) is a separate concept and never grants unit-level permissions.

export const PERMISSIONS = [
  "inventory.view",
  "inventory.manage",
  "inventory.adjust",
  "items.restricted.approve",
  "issuance.perform",
  "requests.submit",
  "requests.approve",
  "members.viewAssignments",
  "members.manage",
  "roles.manage",
  "locations.manage",
  "maintenance.manage",
  "stocktake.run",
  "stocktake.reconcile",
  "reports.view",
  "reports.export",
  "audit.view",
  "unit.settings",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = [
  "unit_admin",
  "junior_cadet",
  "senior_cadet",
  "supply_cadet",
  "civilian_staff",
  "officer_staff",
  "logistics_officer",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  unit_admin: "Unit Administrator",
  junior_cadet: "Junior Cadet",
  senior_cadet: "Senior Cadet/Instructor",
  supply_cadet: "Supply Cadet",
  civilian_staff: "Civilian Staff",
  officer_staff: "Officer Staff",
  logistics_officer: "Logistics Officer",
};

const STAFF_BASE: Permission[] = [
  "inventory.view",
  "inventory.manage",
  "inventory.adjust",
  "issuance.perform",
  "requests.submit",
  "requests.approve",
  "members.viewAssignments",
  "locations.manage",
  "maintenance.manage",
  "stocktake.run",
  "reports.view",
];

// Administration permissions that only the Unit Administrator holds by default.
const ADMIN_ONLY: Permission[] = ["members.manage", "roles.manage", "unit.settings"];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  unit_admin: PERMISSIONS,
  junior_cadet: ["requests.submit"],
  senior_cadet: ["inventory.view", "requests.submit"],
  supply_cadet: [
    "inventory.view",
    "issuance.perform",
    "requests.submit",
    "members.viewAssignments",
    "stocktake.run",
  ],
  civilian_staff: STAFF_BASE,
  officer_staff: [
    ...STAFF_BASE,
    "items.restricted.approve",
    "stocktake.reconcile",
    "reports.export",
  ],
  logistics_officer: PERMISSIONS.filter((permission) => !ADMIN_ONLY.includes(permission)),
};

export const ADMIN_ROLE: RoleKey = "unit_admin";

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

export type MembershipGrants = {
  roles: readonly string[];
  extraPermissions: readonly string[];
  revokedPermissions: readonly string[];
};

type RoleOverrides = Partial<Record<string, readonly string[]>>;

// Effective permissions = union of role defaults and extras, minus revocations.
// `roleOverrides` lets a unit's roleDefinitions replace a system role's defaults.
export function effectivePermissions(
  grants: MembershipGrants,
  roleOverrides?: RoleOverrides,
): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of grants.roles) {
    const override = roleOverrides?.[role];
    const source = override ?? (isRoleKey(role) ? DEFAULT_ROLE_PERMISSIONS[role] : []);
    for (const permission of source) {
      if (isPermission(permission)) result.add(permission);
    }
  }
  for (const permission of grants.extraPermissions) {
    if (isPermission(permission)) result.add(permission);
  }
  for (const permission of grants.revokedPermissions) {
    result.delete(permission as Permission);
  }
  return result;
}

export function hasPermission(
  grants: MembershipGrants,
  permission: Permission,
  roleOverrides?: RoleOverrides,
): boolean {
  return effectivePermissions(grants, roleOverrides).has(permission);
}

// A Unit Administrator cannot assign the administrator role to themselves; another
// administrator (or a verified support grant) must do it.
export function canAssignRoles(
  actorUserId: string,
  targetUserId: string,
  newRoles: readonly string[],
): boolean {
  return !(actorUserId === targetUserId && newRoles.includes(ADMIN_ROLE));
}
