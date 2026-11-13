import { Badge } from "@/components/ui/badge";

export type RequestStatus =
  "submitted" | "approved" | "rejected" | "partially_fulfilled" | "fulfilled" | "cancelled";
export type LineStatus = "pending" | "approved" | "rejected" | "fulfilled";

export type RequestRow = {
  requestId: string;
  status: RequestStatus;
  requesterName: string;
  requiresRestrictedApproval: boolean;
  note?: string;
  decisionNote?: string;
  createdAt: number;
  lines: {
    lineId: string;
    itemId: string;
    itemName: string;
    restricted: boolean;
    quantity: number;
    fulfilledQuantity: number;
    quantityAvailable: number;
    status: LineStatus;
  }[];
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
  partially_fulfilled: "Partly issued",
  fulfilled: "Issued",
  cancelled: "Cancelled",
};

export const LINE_STATUS_LABELS: Record<LineStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  fulfilled: "Issued",
};

// Status is conveyed by text, not colour alone.
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const variant =
    status === "rejected" || status === "cancelled"
      ? "destructive"
      : status === "fulfilled"
        ? "default"
        : "secondary";
  return <Badge variant={variant}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}
