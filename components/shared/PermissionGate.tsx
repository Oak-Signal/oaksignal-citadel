"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MembershipGrants, Permission } from "@/convex/lib/permissions";
import { can } from "@/lib/permissions";

const GrantsContext = createContext<MembershipGrants | undefined>(undefined);

// Supplies the active unit membership's grants to the tree below it.
export function PermissionProvider({
  grants,
  children,
}: {
  grants: MembershipGrants | undefined;
  children: ReactNode;
}) {
  return <GrantsContext.Provider value={grants}>{children}</GrantsContext.Provider>;
}

export function useGrants(): MembershipGrants | undefined {
  return useContext(GrantsContext);
}

export function usePermission(permission: Permission): boolean {
  return can(useContext(GrantsContext), permission);
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
