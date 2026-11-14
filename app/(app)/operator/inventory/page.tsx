"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ITEM_CONDITIONS, ITEM_STATUSES } from "@/convex/lib/validators";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ErrorState } from "@/components/shared/ErrorState";
import { Loading } from "@/components/shared/Loading";
import { NativeSelect } from "@/components/shared/NativeSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDITION_LABELS, ItemForm, STATUS_LABELS } from "./item-form";

type ItemRow = Doc<"items"> & { lowStock: boolean };

const PAGE_SIZE = 25;

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <Label>{label}</Label>
      <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {children}
      </NativeSelect>
    </div>
  );
}

export default function InventoryPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const router = useRouter();
  const unitId = activeUnit?.unitId;
  const allowed = can("inventory.view");

  const [searchText, setSearchText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [condition, setCondition] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const categories = useQuery(
    api.categories.list,
    unitId && allowed ? { unitId, includeArchived: true } : "skip",
  );

  const filters = {
    categoryId: categoryId ? (categoryId as Id<"categories">) : undefined,
    status: status ? (status as Doc<"items">["status"]) : undefined,
    condition: condition ? (condition as Doc<"items">["condition"]) : undefined,
    restricted: restricted ? true : undefined,
    includeArchived: includeArchived || undefined,
  };
  const searching = searchText.trim().length > 0;

  const list = usePaginatedQuery(
    api.items.list,
    unitId && allowed && !searching ? { unitId, ...filters } : "skip",
    { initialNumItems: PAGE_SIZE },
  );
  const found = useQuery(
    api.items.search,
    unitId && allowed && searching ? { unitId, text: searchText.trim(), ...filters } : "skip",
  );

  if (!unitId || !allowed) return <AccessDenied />;

  const categoryName = (id: Id<"categories">) =>
    categories?.find((c) => c._id === id)?.name ?? "Unknown";

  const columns: Column<ItemRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <Link
          href={`/operator/inventory/${row._id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { key: "tag", header: "Asset tag", cell: (row) => row.assetTag ?? "-" },
    { key: "category", header: "Category", cell: (row) => categoryName(row.categoryId) },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.status === "available" ? "default" : "secondary"}>
            {STATUS_LABELS[row.status]}
          </Badge>
          {row.archived ? <Badge variant="outline">Archived</Badge> : null}
        </div>
      ),
    },
    { key: "condition", header: "Condition", cell: (row) => CONDITION_LABELS[row.condition] },
    {
      key: "quantity",
      header: "Available",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          {row.trackingMode === "bulk"
            ? `${row.quantityAvailable} of ${row.quantityOnHand}`
            : row.quantityAvailable === 1
              ? "1"
              : "0"}
          {row.lowStock ? <Badge variant="destructive">Low stock</Badge> : null}
          {row.restricted ? <Badge variant="outline">Restricted</Badge> : null}
        </span>
      ),
    },
  ];

  const rows: ItemRow[] = (searching ? found : list.results) as ItemRow[];
  const loading = searching ? found === undefined : list.status === "LoadingFirstPage";
  const hasFilters = Boolean(categoryId || status || condition || restricted || searching);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Serialized assets and bulk stock held by this unit."
        actions={
          can("inventory.manage") ? (
            <div className="flex gap-3">
              <Link
                href="/operator/settings/categories"
                className="self-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Manage categories
              </Link>
              <Button onClick={() => setCreating(true)}>Add item</Button>
            </div>
          ) : undefined
        }
      />
      <form
        role="search"
        aria-label="Search and filter inventory"
        onSubmit={(event) => event.preventDefault()}
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <Label htmlFor="inventory-search">Search by name or asset tag</Label>
          <Input
            id="inventory-search"
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Filter label="Category" value={categoryId} onChange={setCategoryId}>
          {(categories ?? [])
            .filter((c) => !c.archived)
            .map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
        </Filter>
        <Filter label="Status" value={status} onChange={setStatus}>
          {ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Filter>
        <Filter label="Condition" value={condition} onChange={setCondition}>
          {ITEM_CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </Filter>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={restricted}
            onChange={(e) => setRestricted(e.target.checked)}
          />
          Restricted only
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show archived
        </label>
      </form>

      {loading ? (
        <Loading label="Loading inventory..." />
      ) : categories === undefined ? (
        <Loading label="Loading inventory..." />
      ) : (
        <DataTable
          caption="Inventory items"
          columns={columns}
          rows={rows}
          getRowId={(row) => row._id}
          emptyTitle={hasFilters ? "No items match" : "No items yet"}
          emptyDescription={
            hasFilters
              ? "Try a different search or clear the filters."
              : can("inventory.manage")
                ? "Add your first item to start the catalogue."
                : "Nothing has been added to this unit's catalogue."
          }
        />
      )}
      {!searching && list.status === "CanLoadMore" ? (
        <div className="mt-4">
          <Button variant="outline" onClick={() => list.loadMore(PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}
      {!searching && list.status === "LoadingMore" ? <Loading label="Loading more..." /> : null}
      {searching && found && found.length >= 25 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing the best matches. Refine your search to narrow them down.
        </p>
      ) : null}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add item</DialogTitle>
            <DialogDescription>
              Create a serialized asset or a bulk stock line. Categories are managed in settings.
            </DialogDescription>
          </DialogHeader>
          {categories && categories.every((c) => c.archived) ? (
            <ErrorState
              title="Add a category first"
              description="Every item belongs to a category."
              action={
                <Link
                  href="/operator/settings/categories"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Manage categories
                </Link>
              }
            />
          ) : (
            <ItemForm
              unitId={unitId}
              categories={(categories ?? []).filter((c) => !c.archived)}
              onCancel={() => setCreating(false)}
              onDone={(id) => {
                setCreating(false);
                router.push(`/operator/inventory/${id}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
