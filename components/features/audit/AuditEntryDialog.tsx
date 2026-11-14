"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { actionLabel, entityLabel } from "./audit-labels";

export type AuditRow = {
  _id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  occurredAt: number;
};

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      {value === undefined || value === null ? (
        <p className="text-sm text-muted-foreground">Nothing recorded.</p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs break-words whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </section>
  );
}

// Read-only detail for one audit entry: who, what, when, why, and the values before and after.
export function AuditEntryDialog({ entry, onClose }: { entry: AuditRow; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{actionLabel(entry.action)}</DialogTitle>
          <DialogDescription>
            {entry.actorName} · {formatDateTime(entry.occurredAt)}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Record</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="outline">{entityLabel(entry.entityType)}</Badge>
            <code className="text-xs break-all">{entry.entityId}</code>
          </dd>
          <dt className="text-muted-foreground">Reason</dt>
          <dd>{entry.reason ?? "None given"}</dd>
        </dl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Snapshot title="Before" value={entry.before} />
          <Snapshot title="After" value={entry.after} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
