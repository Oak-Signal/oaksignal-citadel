"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MembershipGrants, Permission } from "@/convex/lib/permissions";
import { can } from "@/lib/permissions";

type PermissionContextValue = {
  grants: MembershipGrants | undefined;
  // Effective permissions computed by the server, including the unit's role overrides. When
  // absent, the default role mappings in `grants` decide.
  permissions: ReadonlySet<string> | undefined;
};

const PermissionContext = createContext<PermissionContextValue>({
  grants: undefined,
  permissions: undefined,
});

// Supplies the active unit membership's grants to the tree below it.
export function PermissionProvider({
  grants,
  permissions,
  children,
}: {
  grants?: MembershipGrants | undefined;
  permissions?: readonly string[] | undefined;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ grants, permissions: permissions ? new Set(permissions) : undefined }),
    [grants, permissions],
  );
  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function useGrants(): MembershipGrants | undefined {
  return useContext(PermissionContext).grants;
}

export function useCan(): (permission: Permission) => boolean {
  const { grants, permissions } = useContext(PermissionContext);
  return (permission) => (permissions ? permissions.has(permission) : can(grants, permission));
}

export function usePermission(permission: Permission): boolean {
  return useCan()(permission);
}

// Renders children only when the member holds the permission. This is a display convenience;
// Convex still enforces the permission on every call.
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePermission(permission) ? <>{children}</> : <>{fallback}</>;
}
