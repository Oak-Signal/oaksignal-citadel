"use client";

import Link from "next/link";
import { useAccess } from "@/components/shared/AccessProvider";
import { useCan } from "@/components/shared/PermissionGate";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roleLabel } from "@/lib/permissions";
import type { Permission } from "@/lib/types";

const SHORTCUTS: { label: string; description: string; href: string; permission: Permission }[] = [
  {
    label: "Members",
    description: "See who is in your unit and what they hold.",
    href: "/operator/members",
    permission: "members.viewAssignments",
  },
  {
    label: "Unit settings",
    description: "Return periods, retention, notifications and exports.",
    href: "/operator/settings",
    permission: "unit.settings",
  },
  {
    label: "Roles",
    description: "Adjust what each role can do in this unit.",
    href: "/operator/settings/roles",
    permission: "roles.manage",
  },
];

export default function OperatorDashboard() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const shortcuts = SHORTCUTS.filter((shortcut) => can(shortcut.permission));
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          activeUnit
            ? `${activeUnit.name} · ${activeUnit.roles.map(roleLabel).join(", ")}`
            : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((shortcut) => (
          <Card key={shortcut.href}>
            <CardHeader>
              <CardTitle>
                <h2>{shortcut.label}</h2>
              </CardTitle>
              <CardDescription>{shortcut.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={shortcut.href}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open {shortcut.label.toLowerCase()}
              </Link>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Inventory and issuance</h2>
            </CardTitle>
            <CardDescription>
              Stock, issuing and returns arrive in the next releases.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
