"use client";

import { useId } from "react";
import { useAccess } from "@/components/shared/AccessProvider";

// Lets a member of several units choose which one they are working in. With one unit it shows
// the unit name; with none it renders nothing. The server still checks membership on every call.
export function UnitSwitcher() {
  const { access, activeUnit, setActiveUnitId } = useAccess();
  const id = useId();
  if (access.units.length === 0 || !activeUnit) return null;

  if (access.units.length === 1) {
    return (
      <p className="text-sm font-medium" data-testid="active-unit">
        {activeUnit.name}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        Active unit
      </label>
      <select
        id={id}
        value={activeUnit.unitId}
        onChange={(event) => setActiveUnitId(event.target.value)}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {access.units.map((unit) => (
          <option key={unit.unitId} value={unit.unitId}>
            {unit.name}
          </option>
        ))}
      </select>
    </div>
  );
}
