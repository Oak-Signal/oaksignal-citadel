import type { NavConfig } from "@/lib/types";

// Navigation per portal. Items with a `permission` are shown only to members who hold it;
// the server enforces the permission regardless (see contracts/routes.md).
export const NAV_CONFIG: NavConfig = {
  "self-service": [
    { label: "My equipment", href: "/self-service/equipment" },
    { label: "My requests", href: "/self-service/requests" },
  ],
  operator: [
    { label: "Dashboard", href: "/operator" },
    { label: "Inventory", href: "/operator/inventory", permission: "inventory.view" },
    { label: "Issuance", href: "/operator/issuance", permission: "issuance.perform" },
    { label: "Requests", href: "/operator/requests", permission: "requests.approve" },
    { label: "Members", href: "/operator/members", permission: "members.viewAssignments" },
    { label: "Locations", href: "/operator/locations", permission: "locations.manage" },
    { label: "Stocktakes", href: "/operator/stocktakes", permission: "stocktake.run" },
    { label: "Reports", href: "/operator/reports", permission: "reports.view" },
    { label: "Audit", href: "/operator/audit", permission: "audit.view" },
    { label: "Settings", href: "/operator/settings", permission: "unit.settings" },
  ],
  platform: [
    { label: "Units", href: "/platform" },
    { label: "Provision a unit", href: "/platform/units/new" },
  ],
};
