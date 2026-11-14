"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAccess } from "@/components/shared/AccessProvider";
import { useCan } from "@/components/shared/PermissionGate";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionLinks } from "@/components/shared/SectionLinks";
import { StatTile } from "@/components/shared/StatTile";
import { NAV_CONFIG, groupNavItems, visibleNavItems } from "@/components/shared/nav-config";
import { buttonVariants } from "@/components/ui/button";
import { roleLabel } from "@/lib/permissions";
import type { Permission } from "@/lib/types";

const QUICK_ACTIONS: { label: string; href: string; permission: Permission }[] = [
  { label: "Issue equipment", href: "/operator/issuance", permission: "issuance.perform" },
  { label: "Record a return", href: "/operator/issuance/returns", permission: "issuance.perform" },
  { label: "Review requests", href: "/operator/requests", permission: "requests.approve" },
];

export default function OperatorDashboard() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;

  const canSeeLoans = can("members.viewAssignments");
  const canSeeRequests = can("requests.approve");
  const loans = useQuery(
    api.assignments.listOutstanding,
    unitId && canSeeLoans ? { unitId } : "skip",
  );
  const requests = useQuery(
    api.requests.listQueue,
    unitId && canSeeRequests ? { unitId, status: "submitted" } : "skip",
  );

  const canSeeIncidents = can("maintenance.manage");
  const incidents = useQuery(api.incidents.list, unitId && canSeeIncidents ? { unitId } : "skip");

  const actions = QUICK_ACTIONS.filter((action) => can(action.permission));
  const sections = groupNavItems(visibleNavItems(NAV_CONFIG.operator, can)).filter(
    (section) => section.title !== "Overview",
  );

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

      {canSeeLoans || canSeeRequests || canSeeIncidents ? (
        <section aria-labelledby="attention-heading" className="mb-8">
          <h2 id="attention-heading" className="mb-3 text-lg font-semibold">
            Needs attention
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {canSeeRequests ? (
              <StatTile
                label="Requests awaiting a decision"
                value={requests?.length}
                href="/operator/requests"
                tone="alert"
              />
            ) : null}
            {canSeeIncidents ? (
              <StatTile
                label="Open incidents"
                value={incidents?.length}
                href="/operator/incidents"
                tone="alert"
              />
            ) : null}
            {canSeeLoans ? (
              <>
                <StatTile
                  label="Overdue returns"
                  value={loans?.filter((row) => row.state === "overdue").length}
                  href="/operator/issuance/returns"
                  tone="alert"
                />
                <StatTile
                  label="Items on loan"
                  value={loans?.length}
                  href="/operator/issuance/returns"
                />
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {actions.length > 0 ? (
        <section aria-labelledby="actions-heading" className="mb-8">
          <h2 id="actions-heading" className="mb-3 text-lg font-semibold">
            Quick actions
          </h2>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={buttonVariants({ variant: "default" })}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <SectionLinks sections={sections} />
    </>
  );
}
