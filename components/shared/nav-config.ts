import type { NavConfig, NavItem, Permission } from "@/lib/types";

// Section order for the sidebar and the dashboard. Items without a group come first.
export const NAV_GROUPS = [
  "Overview",
  "Inventory",
  "Issuance",
  "People",
  "Insights",
  "Administration",
] as const;

// Navigation per portal. Items with a `permission` are shown only to members who hold it;
// the server enforces the permission regardless (see contracts/routes.md). Set
// `available: false` on a link until its page exists, and remove the flag when it ships.
export const NAV_CONFIG: NavConfig = {
  "self-service": [
    { label: "Overview", href: "/self-service" },
    {
      label: "My equipment",
      href: "/self-service/equipment",
      description: "Items issued to you, due dates, and problem reports.",
    },
    {
      label: "My requests",
      href: "/self-service/requests",
      description: "Request equipment and follow its approval.",
    },
  ],
  operator: [
    { label: "Dashboard", href: "/operator", group: "Overview" },
    {
      label: "Inventory",
      href: "/operator/inventory",
      group: "Inventory",
      permission: "inventory.view",
      description: "Browse items, receive stock and manage the catalogue.",
    },
    {
      label: "Categories",
      href: "/operator/settings/categories",
      group: "Inventory",
      permission: "inventory.manage",
      description: "Organise items and define custom attributes.",
    },
    {
      label: "Locations",
      href: "/operator/locations",
      group: "Inventory",
      permission: "locations.manage",
      description: "Where equipment is stored.",
      available: false,
    },
    {
      label: "Stocktakes",
      href: "/operator/stocktakes",
      group: "Inventory",
      permission: "stocktake.run",
      description: "Count stock and reconcile differences.",
      available: false,
    },
    {
      label: "Issuance",
      href: "/operator/issuance",
      group: "Issuance",
      permission: "issuance.perform",
      description: "Issue equipment to members.",
      children: [
        {
          label: "Returns",
          href: "/operator/issuance/returns",
          permission: "issuance.perform",
          description: "See what is outstanding or overdue and record returns.",
        },
      ],
    },
    {
      label: "Requests",
      href: "/operator/requests",
      group: "Issuance",
      permission: "requests.approve",
      description: "Approve or reject member requests and issue approved equipment.",
    },
    {
      label: "Incidents",
      href: "/operator/incidents",
      group: "Inventory",
      permission: "maintenance.manage",
      description: "Review damaged or missing equipment reports.",
    },
    {
      label: "Members",
      href: "/operator/members",
      group: "People",
      permission: "members.viewAssignments",
      description: "See who is in your unit and what they hold.",
    },
    {
      label: "Reports",
      href: "/operator/reports",
      group: "Insights",
      permission: "reports.view",
      description: "Filtered reports and exports.",
      available: false,
    },
    {
      label: "Audit",
      href: "/operator/audit",
      group: "Insights",
      permission: "audit.view",
      description: "Who changed what, and when.",
    },
    {
      label: "Settings",
      href: "/operator/settings",
      group: "Administration",
      permission: "unit.settings",
      description: "Return periods, retention, notifications and exports.",
      children: [
        {
          label: "Roles",
          href: "/operator/settings/roles",
          permission: "roles.manage",
          description: "Adjust what each role can do in this unit.",
        },
      ],
    },
  ],
  platform: [
    { label: "Units", href: "/platform" },
    { label: "Provision a unit", href: "/platform/units/new" },
  ],
};

// Drops links that are not built yet or that the member may not use, including sub-pages.
export function visibleNavItems(
  items: NavItem[],
  can: (permission: Permission) => boolean,
): NavItem[] {
  return items
    .filter((item) => item.available !== false && (!item.permission || can(item.permission)))
    .map((item) =>
      item.children ? { ...item, children: visibleNavItems(item.children, can) } : item,
    );
}

export type NavSection = { title?: string; items: NavItem[] };

// Groups visible items into sections in NAV_GROUPS order. Ungrouped items form a leading
// section with no title; unknown group names follow the known ones.
export function groupNavItems(items: NavItem[]): NavSection[] {
  const known: readonly (string | undefined)[] = NAV_GROUPS;
  const titles = [
    undefined,
    ...NAV_GROUPS,
    ...items.map((item) => item.group).filter((group) => !known.includes(group)),
  ];
  const seen = new Set<string | undefined>();
  const sections: NavSection[] = [];
  for (const title of titles) {
    if (seen.has(title)) continue;
    seen.add(title);
    const group = items.filter((item) => item.group === title);
    if (group.length > 0) sections.push({ title, items: group });
  }
  return sections;
}
