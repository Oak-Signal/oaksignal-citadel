"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { CONDITION_LABELS, ItemForm, STATUS_LABELS } from "../item-form";
import { StockDialog, type StockMode } from "../stock-dialog";

const ACTION_LABELS: Record<string, string> = {
  "item.create": "Item created",
  "item.update": "Item details changed",
  "item.archive": "Item archived",
  "item.restore": "Item restored",
  "item.image.set": "Image updated",
  "item.image.remove": "Image removed",
  "item.attachment.add": "Attachment added",
  "item.attachment.remove": "Attachment removed",
  "stock.receive": "Stock received",
  "stock.adjust": "Quantity adjusted",
};

function FilesCard({
  unitId,
  itemId,
  disabled,
  imageUrl,
  attachments,
}: {
  unitId: Id<"units">;
  itemId: Id<"items">;
  disabled: boolean;
  imageUrl: string | null;
  attachments: { storageId: Id<"_storage">; name: string; url: string | null }[];
}) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const setImage = useMutation(api.files.setItemImage);
  const removeImage = useMutation(api.files.removeItemImage);
  const addAttachment = useMutation(api.files.addAttachment);
  const removeAttachment = useMutation(api.files.removeAttachment);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run(task: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function upload(file: File): Promise<Id<"_storage">> {
    const url = await generateUploadUrl({ unitId });
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) throw new Error("Upload failed.");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    return storageId;
  }

  function pick(handler: (file: File) => Promise<unknown>) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void run(() => handler(file));
    };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Image and attachments</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL, size unknown
          <img src={imageUrl} alt="Item" className="max-h-64 w-fit rounded-lg border" />
        ) : (
          <p className="text-sm text-muted-foreground">No image uploaded.</p>
        )}
        {!disabled ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={imageInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Choose item image"
              tabIndex={-1}
              onChange={pick(async (file) => {
                const storageId = await upload(file);
                await setImage({ itemId, storageId });
              })}
            />
            <Button variant="outline" disabled={pending} onClick={() => imageInput.current?.click()}>
              {imageUrl ? "Replace image" : "Upload image"}
            </Button>
            {imageUrl ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void run(() => removeImage({ itemId }))}
              >
                Remove image
              </Button>
            ) : null}
          </div>
        ) : null}

        <h3 className="text-sm font-medium">Attachments</h3>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((attachment) => (
              <li key={attachment.storageId} className="flex items-center gap-3 text-sm">
                {attachment.url ? (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {attachment.name}
                  </a>
                ) : (
                  attachment.name
                )}
                {!disabled ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    aria-label={`Remove attachment ${attachment.name}`}
                    onClick={() =>
                      void run(() => removeAttachment({ itemId, storageId: attachment.storageId }))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!disabled ? (
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv"
              className="sr-only"
              aria-label="Choose attachment"
              tabIndex={-1}
              onChange={pick(async (file) => {
                const storageId = await upload(file);
                await addAttachment({ itemId, storageId, name: file.name });
              })}
            />
            <Button variant="outline" disabled={pending} onClick={() => fileInput.current?.click()}>
              Add attachment
            </Button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ItemDetailPage() {
  const { itemId: rawId } = useParams<{ itemId: string }>();
  const itemId = rawId as Id<"items">;
  const { activeUnit } = useAccess();
  const can = useCan();
  const allowed = can("inventory.view");
  const unitId = activeUnit?.unitId;

  const item = useQuery(api.items.get, unitId && allowed ? { itemId } : "skip");
  const history = useQuery(api.items.history, unitId && allowed ? { itemId } : "skip");
  const categories = useQuery(
    api.categories.list,
    unitId && allowed ? { unitId, includeArchived: true } : "skip",
  );
  const archive = useMutation(api.items.archive);
  const restore = useMutation(api.items.restore);

  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [stockMode, setStockMode] = useState<StockMode | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!unitId || !allowed) return <AccessDenied />;
  if (item === undefined || categories === undefined) return <Loading label="Loading item..." />;
  if (item === null || item.unitId !== unitId) {
    return (
      <EmptyState
        title="Item not found"
        description="It may have been removed, or it belongs to another unit."
      />
    );
  }

  const canManage = can("inventory.manage");

  async function runItemAction(task: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
      setConfirmArchive(false);
    }
  }

  const details: [string, ReactNode][] = [
    ["Category", item.categoryName],
    ["Tracking", item.trackingMode === "bulk" ? "Bulk stock" : "Serialized asset"],
    ["Asset tag", item.assetTag ?? "-"],
    ["Serial number", item.serialNumber ?? "-"],
    ["SKU", item.sku ?? "-"],
    ["Barcode", item.barcode ?? "-"],
    ["Condition", CONDITION_LABELS[item.condition]],
    ["Location", item.locationId ?? "-"],
    ["Supplier", item.supplier ?? "-"],
    [
      "Quantity",
      item.trackingMode === "bulk"
        ? `${item.quantityAvailable} available of ${item.quantityOnHand} on hand`
        : item.quantityAvailable === 1
          ? "1"
          : "0",
    ],
    ...(item.minThreshold !== undefined
      ? ([["Low-stock threshold", String(item.minThreshold)]] as [string, string][])
      : []),
    ...item.customAttributeDefs.map((def): [string, string] => [
      def.label,
      String(item.customAttributes[def.key] ?? "-"),
    ]),
    ["Description", item.description || "-"],
    ["Notes", item.notes || "-"],
  ];

  return (
    <>
      <PageHeader
        title={item.name}
        description={item.assetTag ? `Asset tag ${item.assetTag}` : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/operator/inventory"
              className="self-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Back to inventory
            </Link>
            {canManage && !item.archived ? (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                {item.trackingMode === "bulk" ? (
                  <Button variant="outline" onClick={() => setStockMode("receive")}>
                    Receive stock
                  </Button>
                ) : null}
              </>
            ) : null}
            {can("inventory.adjust") && !item.archived && item.trackingMode === "bulk" ? (
              <Button variant="outline" onClick={() => setStockMode("adjust")}>
                Adjust quantity
              </Button>
            ) : null}
            {canManage ? (
              item.archived ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => void runItemAction(() => restore({ itemId }))}
                >
                  Restore
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => setConfirmArchive(true)}>
                  Archive
                </Button>
              )
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant={item.status === "available" ? "default" : "secondary"}>
          {STATUS_LABELS[item.status]}
        </Badge>
        {item.archived ? <Badge variant="outline">Archived</Badge> : null}
        {item.restricted ? <Badge variant="outline">Restricted</Badge> : null}
        {item.lowStock ? <Badge variant="destructive">Low stock</Badge> : null}
      </div>
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Details</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <FilesCard
          unitId={unitId}
          itemId={itemId}
          disabled={!canManage || item.archived}
          imageUrl={item.imageUrl}
          attachments={item.attachments}
        />
      </div>

      <section aria-labelledby="history-heading" className="mt-8">
        <h2 id="history-heading" className="mb-3 text-lg font-semibold">
          History
        </h2>
        {history === undefined ? (
          <Loading label="Loading history..." />
        ) : history.length === 0 ? (
          <EmptyState title="No history yet" />
        ) : (
          <ol className="flex flex-col gap-2">
            {history.map((entry, index) => (
              <li
                key={`${entry.kind}-${entry.at}-${index}`}
                className="rounded-lg border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {entry.kind === "audit"
                      ? (ACTION_LABELS[entry.action] ?? entry.action)
                      : `Transaction: ${entry.type} (${entry.quantity > 0 ? "+" : ""}${entry.quantity})`}
                  </span>
                  <time
                    dateTime={new Date(entry.at).toISOString()}
                    className="text-muted-foreground"
                  >
                    {formatDateTime(entry.at)}
                  </time>
                </div>
                {entry.reason ? <p className="mt-1 text-muted-foreground">{entry.reason}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit item</DialogTitle>
            <DialogDescription>
              Quantities change through Receive stock and Adjust quantity so they stay on record.
            </DialogDescription>
          </DialogHeader>
          <ItemForm
            unitId={unitId}
            categories={categories.filter((c) => !c.archived || c._id === item.categoryId)}
            item={item}
            onCancel={() => setEditing(false)}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
      {stockMode ? (
        <StockDialog
          unitId={unitId}
          itemId={itemId}
          itemName={item.name}
          mode={stockMode}
          open
          onOpenChange={(open) => (open ? undefined : setStockMode(null))}
        />
      ) : null}
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${item.name}?`}
        description="The item is hidden from the catalogue and cannot be issued. Its history is kept, and you can restore it later."
        confirmLabel="Archive item"
        destructive
        pending={pending}
        onConfirm={() => runItemAction(() => archive({ itemId }))}
      />
    </>
  );
}
