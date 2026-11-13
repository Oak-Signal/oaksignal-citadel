"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAccess } from "@/components/shared/AccessProvider";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

type Row = {
  assignmentId: string;
  itemName: string;
  assetTag?: string;
  quantityOutstanding: number;
  issuedAt: number;
  expectedReturnAt?: number;
  overdue: boolean;
};

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
];

export default function MyEquipmentPage() {
  const { activeUnit } = useAccess();
  const unitId = activeUnit?.unitId;
  const rows = useQuery(api.selfService.myAssignments, unitId ? { unitId } : "skip");

  return (
    <>
      <PageHeader title="My equipment" description="Equipment currently issued to you." />
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
    </>
  );
}