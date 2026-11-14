"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/components/shared/AccessProvider";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FormField } from "@/components/shared/FormField";
import { Loading } from "@/components/shared/Loading";
import { NativeSelect } from "@/components/shared/NativeSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/format";

type Row = {
  assignmentId: string;
  itemId: string;
  itemName: string;
  assetTag?: string;
  quantityOutstanding: number;
  issuedAt: number;
  expectedReturnAt?: number;
  overdue: boolean;
};

type ReportType = "damage" | "loss";

function ReportDialog({
  unitId,
  row,
  onClose,
  onDone,
}: {
  unitId: Id<"units">;
  row: Row;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const report = useMutation(api.incidents.report);
  const [type, setType] = useState<ReportType>("damage");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      setError("Describe what happened.");
      return;
    }
    setPending(true);
    try {
      await report({ unitId, itemId: row.itemId as Id<"items">, type, description });
      onDone(
        `Thanks. Staff have been told that ${row.itemName} is ${type === "damage" ? "damaged" : "missing"}.`,
      );
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report a problem with {row.itemName}</DialogTitle>
          <DialogDescription>Staff are notified and will follow up with you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField label="What happened?" required>
            {(props) => (
              <NativeSelect
                {...props}
                value={type}
                onChange={(event) => setType(event.target.value as ReportType)}
              >
                <option value="damage">It is damaged</option>
                <option value="loss">It is missing</option>
              </NativeSelect>
            )}
          </FormField>
          <FormField label="Description" required error={error ?? undefined}>
            {(props) => (
              <Input
                {...props}
                value={description}
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MyEquipmentPage() {
  const { activeUnit } = useAccess();
  const unitId = activeUnit?.unitId;
  const rows = useQuery(api.selfService.myAssignments, unitId ? { unitId } : "skip");
  const [selected, setSelected] = useState<Row | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const columns: Column<Row>[] = [
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
    { key: "qty", header: "Quantity", cell: (row) => row.quantityOutstanding },
    { key: "issued", header: "Issued", cell: (row) => formatDate(row.issuedAt) },
    {
      key: "due",
      header: "Due back",
      cell: (row) => (row.expectedReturnAt ? formatDate(row.expectedReturnAt) : "No date set"),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) =>
        row.overdue ? (
          <Badge variant="destructive">Overdue</Badge>
        ) : (
          <Badge variant="secondary">On loan</Badge>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Report a problem with ${row.itemName}`}
          onClick={() => {
            setMessage(null);
            setSelected(row);
          }}
        >
          Report problem
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="My equipment" description="Equipment currently issued to you." />
      {message ? (
        <p role="status" className="mb-4 text-sm text-green-700 dark:text-green-400">
          {message}
        </p>
      ) : null}
      {rows === undefined ? (
        <Loading label="Loading your equipment..." />
      ) : (
        <DataTable
          caption="Equipment issued to you"
          columns={columns}
          rows={rows as Row[]}
          getRowId={(row) => row.assignmentId}
          emptyTitle="Nothing issued to you"
          emptyDescription="Items issued to you will be listed here."
        />
      )}
      {selected && unitId ? (
        <ReportDialog
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
