"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import {
  LINE_STATUS_LABELS,
  RequestStatusBadge,
  type RequestRow,
} from "@/components/features/requests/request-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";

function FulfilDialog({
  unitId,
  request,
  onClose,
  onDone,
}: {
  unitId: Id<"units">;
  request: RequestRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const fulfil = useMutation(api.requests.fulfil);
  const open = request.lines.filter(
    (line) => line.status === "approved" && line.fulfilledQuantity < line.quantity,
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      open.map((line) => [line.lineId, String(line.quantity - line.fulfilledQuantity)]),
    ),
  );
  const [requestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const lines: { lineId: Id<"requestLines">; quantity: number }[] = [];
    for (const line of open) {
      const quantity = Number(quantities[line.lineId]);
      const remaining = line.quantity - line.fulfilledQuantity;
      if (quantities[line.lineId] === "" || quantity === 0) continue;
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > remaining) {
        setError(`Enter 0 to ${remaining} for ${line.itemName}.`);
        return;
      }
      lines.push({ lineId: line.lineId as Id<"requestLines">, quantity });
    }
    if (lines.length === 0) {
      setError("Enter a quantity to issue for at least one item.");
      return;
    }
    setPending(true);
    try {
      await fulfil({ unitId, requestId: request.requestId as Id<"requests">, lines, requestKey });
      onDone(`Issued equipment to ${request.requesterName}.`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue to {request.requesterName}</DialogTitle>
          <DialogDescription>
            Issue less than the approved amount to fulfil the request in parts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {open.map((line) => (
            <FormField
              key={line.lineId}
              label={`${line.itemName} (${line.quantityAvailable} in stock)`}
              hint={`Approved: ${line.quantity - line.fulfilledQuantity} still to issue`}
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  step={1}
                  value={quantities[line.lineId] ?? ""}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [line.lineId]: event.target.value }))
                  }
                />
              )}
            </FormField>
          ))}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Issuing..." : "Issue equipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QueueCard({
  unitId,
  request,
  onResult,
  onFulfil,
}: {
  unitId: Id<"units">;
  request: RequestRow;
  onResult: (message: string | null, error: string | null) => void;
  onFulfil: (request: RequestRow) => void;
}) {
  const can = useCan();
  const decide = useMutation(api.requests.decide);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const canRestricted = can("items.restricted.approve");
  const hasPending = request.lines.some((line) => line.status === "pending");
  const hasIssuable = request.lines.some(
    (line) => line.status === "approved" && line.fulfilledQuantity < line.quantity,
  );

  async function choose(lineId: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await decide({
        unitId,
        requestId: request.requestId as Id<"requests">,
        decisions: [{ lineId: lineId as Id<"requestLines">, decision }],
        note: note.trim() || undefined,
      });
      onResult(decision === "approve" ? "Item approved." : "Item rejected.", null);
    } catch (caught) {
      onResult(null, getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <h2>
                {request.requesterName}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {formatDate(request.createdAt)}
                </span>
              </h2>
            </CardTitle>
            <div className="flex items-center gap-2">
              {request.requiresRestrictedApproval ? (
                <Badge variant="outline">Restricted item</Badge>
              ) : null}
              <RequestStatusBadge status={request.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {request.note ? <p className="text-sm">Note: {request.note}</p> : null}
          <ul className="flex flex-col gap-2">
            {request.lines.map((line) => {
              const blocked = line.restricted && !canRestricted;
              return (
                <li
                  key={line.lineId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {line.quantity} × {line.itemName}
                    {line.restricted ? " (restricted)" : ""}
                    <span className="text-muted-foreground">
                      {" "}
                      · {line.quantityAvailable} in stock
                      {line.fulfilledQuantity > 0 ? ` · ${line.fulfilledQuantity} issued` : ""}
                    </span>
                  </span>
                  {line.status === "pending" ? (
                    <span className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={busy || blocked}
                        aria-label={`Approve ${line.itemName}`}
                        onClick={() => void choose(line.lineId, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Reject ${line.itemName}`}
                        onClick={() => void choose(line.lineId, "reject")}
                      >
                        Reject
                      </Button>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{LINE_STATUS_LABELS[line.status]}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {hasPending ? (
            <>
              {!canRestricted &&
              request.lines.some((line) => line.restricted && line.status === "pending") ? (
                <p className="text-xs text-muted-foreground">
                  Restricted items need approval from Officer Staff or a Logistics Officer.
                </p>
              ) : null}
              <FormField label="Decision note" hint="Optional. The requester will see this.">
                {(props) => (
                  <Input
                    {...props}
                    value={note}
                    maxLength={2000}
                    onChange={(event) => setNote(event.target.value)}
                  />
                )}
              </FormField>
            </>
          ) : null}
          {hasIssuable && can("issuance.perform") ? (
            <div>
              <Button
                size="sm"
                aria-label={`Issue equipment to ${request.requesterName}`}
                onClick={() => onFulfil(request)}
              >
                Issue equipment
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

export default function OperatorRequestsPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("requests.approve");
  const requests = useQuery(api.requests.listQueue, unitId && allowed ? { unitId } : "skip");
  const [fulfilling, setFulfilling] = useState<RequestRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!unitId || !allowed) return <AccessDenied />;

  // Keep the dialog in step with live data so remaining quantities stay correct.
  const fulfillingNow = fulfilling
    ? ((requests as RequestRow[] | undefined)?.find((r) => r.requestId === fulfilling.requestId) ??
      fulfilling)
    : null;

  return (
    <>
      <PageHeader
        title="Equipment requests"
        description="Approve or reject requests, then issue the approved equipment."
      />
      {message ? (
        <p role="status" className="mb-4 text-sm text-green-700 dark:text-green-400">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {requests === undefined ? (
        <Loading label="Loading requests..." />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No open requests"
          description="New requests from members will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {(requests as RequestRow[]).map((request) => (
            <QueueCard
              key={request.requestId}
              unitId={unitId}
              request={request}
              onResult={(ok, failure) => {
                setMessage(ok);
                setError(failure);
              }}
              onFulfil={(target) => {
                setMessage(null);
                setError(null);
                setFulfilling(target);
              }}
            />
          ))}
        </ul>
      )}
      {fulfillingNow ? (
        <FulfilDialog
          unitId={unitId}
          request={fulfillingNow}
          onClose={() => setFulfilling(null)}
          onDone={(text) => {
            setMessage(text);
            setFulfilling(null);
          }}
        />
      ) : null}
    </>
  );
}
