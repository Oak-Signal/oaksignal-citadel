"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { roleLabel } from "@/lib/permissions";
import { dueText, StateBadge, type AssignmentRow } from "../../issuance/assignment-state";

export default function MemberAssignmentsPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("members.viewAssignments");
  const membershipId = memberId as Id<"memberships">;

  const member = useQuery(
    api.memberships.get,
    unitId && allowed ? { unitId, membershipId } : "skip",
  );
  const rows = useQuery(
    api.assignments.listOutstanding,
    unitId && allowed ? { unitId, memberId: membershipId } : "skip",
  );

  if (!unitId || !allowed) return <AccessDenied />;
  if (member === undefined || rows === undefined) return <Loading label="Loading member..." />;
  if (member === null) {
    return (
      <EmptyState
        title="Member not found"
        description="This member is not part of the active unit."
      />
    );
  }

  const columns: Column<AssignmentRow>[] = [
    {
      key: "item",
      header: "Item",
      cell: (row) => (
        <>
          {row.itemName}
          {row.assetTag ? <span className="text-muted-foreground"> ({row.assetTag})</span> : null}
        </>
      ),
    },
    {
      key: "qty",
      header: "Outstanding",
      cell: (row) => `${row.quantityOutstanding} of ${row.quantityIssued}`,
    },
    { key: "due", header: "Due", cell: (row) => dueText(row) },
    { key: "state", header: "Status", cell: (row) => <StateBadge state={row.state} /> },
  ];

  return (
    <>
      <PageHeader
        title={member.displayName}
        description={`${member.roles.map(roleLabel).join(", ")} · ${member.status}`}
        actions={
          <Link
            href="/operator/members"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to members
          </Link>
        }
      />
      <h2 className="mb-3 text-lg font-medium">Equipment on loan</h2>
      <DataTable
        caption={`Equipment held by ${member.displayName}`}
        columns={columns}
        rows={rows as AssignmentRow[]}
        getRowId={(row) => row.assignmentId}
        emptyTitle="No equipment on loan"
      />
    </>
  );
}
