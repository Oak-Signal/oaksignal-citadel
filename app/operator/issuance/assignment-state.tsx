import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export type AssignmentRow = {
  assignmentId: string;
  itemId: string;
  itemName: string;
  assetTag?: string;
  trackingMode: "serialized" | "bulk";
  memberId: string;
  memberName: string;
  quantityIssued: number;
  quantityReturned: number;
  quantityOutstanding: number;
  issuedAt: number;
  expectedReturnAt?: number;
  state: "overdue" | "due_soon" | "outstanding";
};

const STATE_LABELS: Record<AssignmentRow["state"], string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  outstanding: "Outstanding",
};

// State is conveyed by text, not colour alone.
export function StateBadge({ state }: { state: AssignmentRow["state"] }) {
  return (
    <Badge variant={state === "overdue" ? "destructive" : state === "due_soon" ? "default" : "secondary"}>
      {STATE_LABELS[state]}
    </Badge>
  );
}

export function dueText(row: Pick<AssignmentRow, "expectedReturnAt">): string {
  return row.expectedReturnAt === undefined ? "No date set" : formatDate(row.expectedReturnAt);
}
