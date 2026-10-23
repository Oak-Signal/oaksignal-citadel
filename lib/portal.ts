// Portal routing rules. Pure functions so the same logic is used by the layouts and the tests.
// These decide what to SHOW; the server enforces every permission again.
import type { Id } from "@/convex/_generated/dataModel";
import type { Portal } from "@/lib/types";

export type AccessState =
  "signed_out" | "syncing" | "no_unit" | "pending_invitation" | "inactive" | "active";

export type UnitAccessView = {
  unitId: Id<"units">;
  name: string;
  roles: string[];
  permissions: string[];
};

export type InvitationView = { membershipId: Id<"memberships">; unitName: string; roles: string[] };

export type AccessView = {
  state: AccessState;
  isPlatformAdmin: boolean;
  units: UnitAccessView[];
  invitations: InvitationView[];
};

// Anyone with a permission beyond submitting their own requests works in the Operator portal;
// everyone else uses Self-service.
export function hasOperatorAccess(unit: UnitAccessView | undefined): boolean {
  return !!unit && unit.permissions.some((permission) => permission !== "requests.submit");
}

// Where a signed-in user lands. `null` means the access state is still loading.
export function defaultPath(
  access: AccessView,
  activeUnit: UnitAccessView | undefined,
): string | null {
  switch (access.state) {
    case "signed_out":
    case "syncing":
      return null;
    case "active":
      return hasOperatorAccess(activeUnit) ? "/operator" : "/self-service";
    case "pending_invitation":
      return "/accept-invite";
    case "no_unit":
      return access.isPlatformAdmin ? "/platform" : "/no-access";
    case "inactive":
      return access.isPlatformAdmin ? "/platform" : "/no-access";
  }
}

export type PortalDecision = "loading" | "allow" | "deny" | "no-access";

// Whether the user may view a portal. "deny" shows the access-denied page for a restricted URL;
// "no-access" sends a user with no active membership to the onboarding states page.
export function decidePortal(
  portal: Portal,
  access: AccessView,
  activeUnit: UnitAccessView | undefined,
): PortalDecision {
  if (access.state === "signed_out" || access.state === "syncing") return "loading";
  if (portal === "platform") return access.isPlatformAdmin ? "allow" : "deny";
  if (access.state !== "active" || !activeUnit) return "no-access";
  if (portal === "operator") return hasOperatorAccess(activeUnit) ? "allow" : "deny";
  return "allow";
}
