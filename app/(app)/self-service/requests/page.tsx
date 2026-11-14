"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/components/shared/AccessProvider";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { Loading } from "@/components/shared/Loading";
import { NativeSelect } from "@/components/shared/NativeSelect";
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
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";

type Draft = { key: string; itemId: string; quantity: string };

const newDraft = (): Draft => ({ key: crypto.randomUUID(), itemId: "", quantity: "1" });

function RequestForm({
  unitId,
  onDone,
}: {
  unitId: Id<"units">;
  onDone: (message: string) => void;
}) {
  const items = useQuery(api.selfService.requestableItems, { unitId });
  const submit = useMutation(api.requests.submit);
  const [drafts, setDrafts] = useState<Draft[]>(() => [newDraft()]);
  const [note, setNote] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const chosen = new Set<string>();
    for (const draft of drafts) {
      const quantity = Number(draft.quantity);
      if (!draft.itemId) next[draft.key] = "Choose an item.";
      else if (chosen.has(draft.itemId)) next[draft.key] = "This item is already in the request.";
      else if (!Number.isInteger(quantity) || quantity < 1) {
        next[draft.key] = "Enter a whole number of 1 or more.";
      }
      chosen.add(draft.itemId);
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      await submit({
        unitId,
        lines: drafts.map((d) => ({
          itemId: d.itemId as Id<"items">,
          quantity: Number(d.quantity),
        })),
        note: note.trim() || undefined,
        requestKey,
      });
      setDrafts([newDraft()]);
      setNote("");
      setRequestKey(crypto.randomUUID());
      onDone("Your request was submitted.");
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
    } finally {
      setPending(false);
    }
  }

  if (items === undefined) return <Loading label="Loading items..." />;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>
          <h2>Request equipment</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {errors._form ? (
            <p role="alert" className="text-sm text-destructive">
              {errors._form}
            </p>
          ) : null}
          {drafts.map((draft, index) => (
            <div key={draft.key} className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <FormField label={`Item ${index + 1}`} required error={errors[draft.key]}>
                  {(props) => (
                    <NativeSelect
                      {...props}
                      value={draft.itemId}
                      onChange={(event) => update(draft.key, { itemId: event.target.value })}
                    >
                      <option value="">Choose an item</option>
                      {items.map((item) => (
                        <option key={item.itemId} value={item.itemId}>
                          {item.name}
                          {item.assetTag ? ` (${item.assetTag})` : ""}
                          {item.restricted ? " - restricted" : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              </div>
              <div className="w-28">
                <FormField label="Quantity" required>
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min={1}
                      step={1}
                      value={draft.quantity}
                      onChange={(event) => update(draft.key, { quantity: event.target.value })}
                    />
                  )}
                </FormField>
              </div>
              {drafts.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Remove item ${index + 1}`}
                  onClick={() => setDrafts((current) => current.filter((d) => d.key !== draft.key))}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={drafts.length >= 50}
              onClick={() => setDrafts((current) => [...current, newDraft()])}
            >
              Add another item
            </Button>
          </div>
          <FormField label="Note" hint="Optional. Say why you need this equipment.">
            {(props) => (
              <Input
                {...props}
                value={note}
                maxLength={2000}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </FormField>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting..." : "Submit request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RequestCard({
  request,
  onCancel,
}: {
  request: RequestRow;
  onCancel: (request: RequestRow) => void;
}) {
  const cancellable = request.status === "submitted" || request.status === "approved";
  return (
    <li>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <h3>Requested {formatDate(request.createdAt)}</h3>
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
          <ul className="flex flex-col gap-1 text-sm">
            {request.lines.map((line) => (
              <li key={line.lineId} className="flex flex-wrap justify-between gap-2">
                <span>
                  {line.quantity} × {line.itemName}
                  {line.fulfilledQuantity > 0 ? ` (${line.fulfilledQuantity} issued)` : ""}
                </span>
                <span className="text-muted-foreground">{LINE_STATUS_LABELS[line.status]}</span>
              </li>
            ))}
          </ul>
          {request.decisionNote ? (
            <p className="text-sm text-muted-foreground">Decision note: {request.decisionNote}</p>
          ) : null}
          {cancellable ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Cancel request from ${formatDate(request.createdAt)}`}
                onClick={() => onCancel(request)}
              >
                Cancel request
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

export default function MyRequestsPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const requests = useQuery(api.selfService.myRequests, unitId ? { unitId } : "skip");
  const cancel = useMutation(api.requests.cancel);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<RequestRow | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmCancel() {
    if (!unitId || !toCancel) return;
    setPending(true);
    try {
      await cancel({ unitId, requestId: toCancel.requestId as Id<"requests"> });
      setMessage("Your request was cancelled.");
      setError(null);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
      setToCancel(null);
    }
  }

  return (
    <>
      <PageHeader
        title="My requests"
        description="Ask for equipment and follow the progress of your requests."
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
      {unitId && can("requests.submit") ? (
        <RequestForm
          unitId={unitId}
          onDone={(text) => {
            setError(null);
            setMessage(text);
          }}
        />
      ) : null}
      <h2 className="mb-3 text-lg font-semibold">Your requests</h2>
      {requests === undefined ? (
        <Loading label="Loading your requests..." />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Requests you submit will be listed here with their status."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {(requests as RequestRow[]).map((request) => (
            <RequestCard key={request.requestId} request={request} onCancel={setToCancel} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => (open ? undefined : setToCancel(null))}
        title="Cancel this request?"
        description="Staff will no longer see it. You can submit a new request at any time."
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        destructive
        pending={pending}
        onConfirm={confirmCancel}
      />
    </>
  );
}
