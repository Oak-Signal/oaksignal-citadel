"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";

type Status = "open" | "in_progress" | "resolved";

const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export default function OperatorIncidentsPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("maintenance.manage");
  const [showResolved, setShowResolved] = useState(false);
  const incidents = useQuery(
    api.incidents.list,
    unitId && allowed ? { unitId, includeResolved: showResolved } : "skip",
  );
  const setStatus = useMutation(api.incidents.setStatus);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!unitId || !allowed) return <AccessDenied />;

  async function update(incidentId: Id<"incidents">, status: Status) {
    setError(null);
    setBusyId(incidentId);
    try {
      await setStatus({ incidentId, status });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Damaged or missing equipment reported by members."
        actions={
          <Button variant="outline" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? "Hide resolved" : "Show resolved"}
          </Button>
        }
      />
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {incidents === undefined ? (
        <Loading label="Loading incidents..." />
      ) : incidents.length === 0 ? (
        <EmptyState
          title="No open incidents"
          description="Reports from members will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {incidents.map((incident) => (
            <li key={incident.incidentId}>
              <Card>
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link
                      href={`/operator/inventory/${incident.itemId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {incident.itemName}
                      {incident.assetTag ? ` (${incident.assetTag})` : ""}
                    </Link>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {incident.type === "loss" ? "Missing" : "Damaged"}
                    </Badge>
                    <Badge variant={incident.status === "resolved" ? "secondary" : "default"}>
                      {STATUS_LABELS[incident.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm">{incident.description}</p>
                  <p className="text-sm text-muted-foreground">
                    Reported by {incident.reportedByName} on {formatDate(incident.occurredAt)}
                  </p>
                  {incident.status !== "resolved" ? (
                    <div className="flex flex-wrap gap-2">
                      {incident.status === "open" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === incident.incidentId}
                          onClick={() => update(incident.incidentId, "in_progress")}
                        >
                          Start review
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        disabled={busyId === incident.incidentId}
                        onClick={() => update(incident.incidentId, "resolved")}
                      >
                        Mark resolved
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
