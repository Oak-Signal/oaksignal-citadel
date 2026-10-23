"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PermissionProvider } from "@/components/shared/PermissionGate";
import type { AccessView, UnitAccessView } from "@/lib/portal";

const STORAGE_KEY = "citadel.activeUnit";

export type AccessContextValue = {
  access: AccessView;
  activeUnit: UnitAccessView | undefined;
  setActiveUnitId: (unitId: string) => void;
};

const LOADING: AccessView = {
  state: "syncing",
  isPlatformAdmin: false,
  units: [],
  invitations: [],
};

const AccessContext = createContext<AccessContextValue>({
  access: LOADING,
  activeUnit: undefined,
  setActiveUnitId: () => undefined,
});

export function useAccess(): AccessContextValue {
  return useContext(AccessContext);
}

// Supplies a ready-made access value and its permissions. Used by AccessProvider and by tests.
export function AccessValueProvider({
  value,
  children,
}: {
  value: AccessContextValue;
  children: ReactNode;
}) {
  return (
    <AccessContext.Provider value={value}>
      <PermissionProvider permissions={value.activeUnit?.permissions}>
        {children}
      </PermissionProvider>
    </AccessContext.Provider>
  );
}

function readStoredUnit(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Loads the signed-in user's access summary and tracks which unit they are working in. A stored
// unit that is no longer available falls back to the first active unit, never to someone else's.
export function AccessProvider({ children }: { children: ReactNode }) {
  const result = useQuery(api.access.myAccess, {});
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredUnit(),
  );

  const setActiveUnitId = useCallback((unitId: string) => {
    setSelected(unitId);
    try {
      window.localStorage.setItem(STORAGE_KEY, unitId);
    } catch {
      // The selection still applies for this session.
    }
  }, []);

  const value = useMemo<AccessContextValue>(() => {
    const access: AccessView = result ?? LOADING;
    const activeUnit = access.units.find((unit) => unit.unitId === selected) ?? access.units[0];
    return { access, activeUnit, setActiveUnitId };
  }, [result, selected, setActiveUnitId]);

  return <AccessValueProvider value={value}>{children}</AccessValueProvider>;
}
