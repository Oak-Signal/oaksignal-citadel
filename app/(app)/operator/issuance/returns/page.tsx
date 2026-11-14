"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ITEM_CONDITIONS } from "@/convex/lib/validators";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FormField } from "@/components/shared/FormField";
import { Loading } from "@/components/shared/Loading";
import { NativeSelect } from "@/components/shared/NativeSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { Button } from "@/components/ui/button";
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
import { CONDITION_LABELS } from "../../inventory/item-form";
import { dueText, StateBadge, type AssignmentRow } from "../assignment-state";

type Condition = (typeof ITEM_CONDITIONS)[number];
type Outcome = "available" | "damaged" | "missing" | "unserviceable";

const OUTCOME_LABELS: Record<Outcome, string> = {
  available: "Back in stock",
  damaged: "Damaged - needs follow-up",
  missing: "Missing - needs follow-up",
  unserviceable: "Unserviceable - needs follow-up",
};

function ReturnDialog({
  unitId,
  row,
  onClose,
  onDone,
}: {
  unitId: Id<"units">;
  row: AssignmentRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const returnItems = useMutation(api.transactions.return);
  const [quantity, setQuantity] = useState(String(row.quantityOutstanding));
  const [condition, setCondition] = useState<Condition>("good");
  const [outcome, setOutcome] = useState<Outcome>("available");
  const [note, setNote] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const isDiscrepancy = outcome !== "available";

  function changeOutcome(next: Outcome) {
    setOutcome(next);
    if (next === "unserviceable") setCondition("unserviceable");
    else if (condition === "unserviceable") setCondition("poor");
  }

  function review(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > row.quantityOutstanding) {
      next.quantity = `Enter a whole number from 1 to ${row.quantityOutstanding}.`;
    }
    if (isDiscrepancy && !note.trim()) next.note = "Explain what happened.";
    if (outcome === "available" && condition === "unserviceable") {
      next.condition = "Unserviceable items cannot go back into stock.";
    }
    setErrors(next);
    if (Object.keys(next).length === 0) setStep("confirm");
  }

  async function confirm() {
    setPending(true);
    setErrors({});
    try {
      await returnItems({
        unitId,
        lines: [
          {
            assignmentId: row.assignmentId as Id<"assignments">,
            quantity: Number(quantity),
            condition,
            outcome,
            note: note.trim() || undefined,
          },
        ],
        requestKey,
      });
      setRequestKey(crypto.randomUUID());
      onDone(`Recorded the return of ${quantity} × ${row.itemName} from ${row.memberName}.`);
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
      setStep("form");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return {row.itemName}</DialogTitle>
          <DialogDescription>
            {row.memberName} holds {row.quantityOutstanding} of {row.quantityIssued}.
          </DialogDescription>
        </DialogHeader>
        {step === "form" ? (
          <form onSubmit={review} className="flex flex-col gap-4" noValidate>
            <FormField label="Quantity returned" required error={errors.quantity}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={row.quantityOutstanding}
                  step={1}
                  disabled={row.trackingMode === "serialized"}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              )}
            </FormField>
            <FormField label="Outcome" required>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={outcome}
                  onChange={(event) => changeOutcome(event.target.value as Outcome)}
                >
                  {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((key) => (
                    <option key={key} value={key}>
                      {OUTCOME_LABELS[key]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label="Condition on return" required error={errors.condition}>
              {(props) => (
                <NativeSelect
                  {...props}
                  value={condition}
                  onChange={(event) => setCondition(event.target.value as Condition)}
                >
                  {ITEM_CONDITIONS.map((key) => (
                    <option key={key} value={key}>
                      {CONDITION_LABELS[key]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField
              label={isDiscrepancy ? "Discrepancy note" : "Note"}
              required={isDiscrepancy}
              error={errors.note}
            >
              {(props) => (
                <Input
                  {...props}
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              )}
            </FormField>
            {errors._form ? (
              <p role="alert" className="text-sm text-destructive">
                {errors._form}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Review return</Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Record {quantity} × {row.itemName} as returned by {row.memberName}:{" "}
              {OUTCOME_LABELS[outcome].toLowerCase()}, condition{" "}
              {CONDITION_LABELS[condition].toLowerCase()}.
              {note.trim() ? ` Note: ${note.trim()}` : ""}
            </p>
            <DialogFooter>
              <Button variant="outline" disabled={pending} onClick={() => setStep("form")}>
                Back
              </Button>
              <Button disabled={pending} onClick={() => void confirm()}>
                {pending ? "Saving..." : "Confirm return"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ReturnsPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("issuance.perform") && can("members.viewAssignments");
  const rows = useQuery(api.assignments.listOutstanding, unitId && allowed ? { unitId } : "skip");
  const [selected, setSelected] = useState<AssignmentRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!unitId || !allowed) return <AccessDenied />;

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
      key: "member",
      header: "Held by",
      cell: (row) => (
        <Link
          href={`/operator/members/${row.memberId}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          {row.memberName}
        </Link>
      ),
    },
    {
      key: "qty",
      header: "Outstanding",
      cell: (row) => `${row.quantityOutstanding} of ${row.quantityIssued}`,
    },
    { key: "due", header: "Due", cell: (row) => dueText(row) },
    { key: "state", header: "Status", cell: (row) => <StateBadge state={row.state} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Return ${row.itemName} from ${row.memberName}`}
          onClick={() => {
            setMessage(null);
            setSelected(row);
          }}
        >
          Return
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Returns and outstanding equipment"
        description="Everything currently issued. Overdue items are listed first."
        actions={
          <Link
            href="/operator/issuance"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Issue equipment
          </Link>
        }
      />
      {message ? (
        <p role="status" className="mb-4 text-sm text-green-700 dark:text-green-400">
          {message}
        </p>
      ) : null}
      {rows === undefined ? (
        <Loading label="Loading outstanding equipment..." />
      ) : (
        <DataTable
          caption="Outstanding equipment"
          columns={columns}
          rows={rows as AssignmentRow[]}
          getRowId={(row) => row.assignmentId}
          emptyTitle="Nothing is currently issued"
          emptyDescription="Issued equipment appears here until it is returned."
        />
      )}
      {selected ? (
        <ReturnDialog
          unitId={unitId}
          row={selected}
          onClose={() => setSelected(null)}
          onDone={(text) => {
            setMessage(text);
            setSelected(null);
          }}
        />
      ) : null}
    </>
  );
}
