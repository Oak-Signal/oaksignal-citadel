"use client";

import { useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { type Column, DataTable } from "@/components/shared/DataTable";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { AuditEntryDialog, type AuditRow } from "@/components/features/audit/AuditEntryDialog";
import {
  AuditFilters,
  EMPTY_FILTERS,
  type AuditFilterValues,
} from "@/components/features/audit/AuditFilters";
import { actionLabel, entityLabel } from "@/components/features/audit/audit-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

// Date inputs give local calendar days; the range covers the whole of both days.
function dayStart(value: string): number | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function dayEnd(value: string): number | undefined {
  const start = dayStart(value);
  return start === undefined ? undefined : start + DAY_MS - 1;
}

export default function AuditPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("audit.view");
  const [filters, setFilters] = useState<AuditFilterValues>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const actors = useQuery(api.audit.actors, unitId && allowed ? { unitId } : "skip");
  const args = useMemo(
    () =>
      unitId && allowed
        ? {
            unitId,
            actorId: filters.actorId ? (filters.actorId as Id<"users">) : undefined,
            entityType: filters.entityType || undefined,
            entityId: filters.entityId || undefined,
            action: filters.action || undefined,
            from: dayStart(filters.from),
            to: dayEnd(filters.to),
          }
        : ("skip" as const),
    [unitId, allowed, filters],
  );
  const { results, status, loadMore } = usePaginatedQuery(api.audit.list, args, {
    initialNumItems: 25,
  });

  if (!unitId || !allowed) return <AccessDenied />;

  const columns: Column<AuditRow>[] = [
    {
      key: "time",
      header: "When",
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.occurredAt)}</span>,
    },
    { key: "actor", header: "Who", cell: (row) => row.actorName },
    { key: "action", header: "What", cell: (row) => actionLabel(row.action) },
    {
      key: "entity",
      header: "Record",
      cell: (row) => <Badge variant="outline">{entityLabel(row.entityType)}</Badge>,
    },
    {
      key: "reason",
      header: "Reason",
      className: "max-w-64 truncate",
      cell: (row) => row.reason ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "details",
      header: "Details",
      cell: (row) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
          View<span className="sr-only"> {actionLabel(row.action)} details</span>
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit history"
        description="Who changed what, when, and why. Entries are permanent and cannot be edited."
      />
      <AuditFilters values={filters} actors={actors ?? []} onChange={setFilters} />
      {status === "LoadingFirstPage" ? (
        <Loading label="Loading audit history..." />
      ) : (
        <>
          <DataTable
            caption="Audit history, newest first"
            columns={columns}
            rows={results as AuditRow[]}
            getRowId={(row) => row._id}
            emptyTitle="No matching entries"
            emptyDescription="Try widening the filters or date range."
          />
          {status === "CanLoadMore" || status === "LoadingMore" ? (
            <div className="mt-4">
              <Button
                variant="outline"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(25)}
              >
                {status === "LoadingMore" ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
      {selected ? <AuditEntryDialog entry={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
