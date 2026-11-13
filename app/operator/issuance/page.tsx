"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ITEM_CONDITIONS } from "@/convex/lib/validators";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField } from "@/components/shared/FormField";
import { NativeSelect } from "@/components/shared/NativeSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { CONDITION_LABELS, STATUS_LABELS } from "../inventory/item-form";

type Condition = (typeof ITEM_CONDITIONS)[number];
type DraftLine = {
  itemId: Id<"items">;
  name: string;
  assetTag?: string;
  serialized: boolean;
  available: number;
  quantity: string;
  condition: Condition;
};

const ISSUE_CONDITIONS = ITEM_CONDITIONS.filter((c) => c !== "unserviceable");

// End of the chosen day in local time, so an item due "today" is not instantly overdue.
function endOfDay(value: string): number | undefined {
  if (!value) return undefined;
  const time = new Date(`${value}T23:59:59`).getTime();
  return Number.isNaN(time) ? undefined : time;
}

export default function IssuancePage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("issuance.perform") && can("members.viewAssignments");

  const members = usePaginatedQuery(
    api.memberships.list,
    unitId && allowed ? { unitId } : "skip",
    { initialNumItems: 100 },
  );
  const issue = useMutation(api.transactions.issue);

  const [memberId, setMemberId] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [expected, setExpected] = useState("");
  const [note, setNote] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const results = useQuery(
    api.items.search,
    unitId && allowed && search.trim() ? { unitId, text: search } : "skip",
  );

  if (!unitId || !allowed) return <AccessDenied />;

  const activeMembers = members.results.filter((member) => member.status === "active");
  const memberName = activeMembers.find((member) => member.membershipId === memberId)?.displayName;

  function addItem(item: NonNullable<typeof results>[number]) {
    if (lines.some((line) => line.itemId === item._id)) return;
    setLines((current) => [
      ...current,
      {
        itemId: item._id,
        name: item.name,
        assetTag: item.assetTag,
        serialized: item.trackingMode === "serialized",
        available: item.quantityAvailable,
        quantity: "1",
        condition: item.condition === "unserviceable" ? "poor" : item.condition,
      },
    ]);
    setSearch("");
  }

  function updateLine(itemId: Id<"items">, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.itemId === itemId ? { ...line, ...patch } : line)),
    );
  }

  function review(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!memberId) next.member = "Choose who the equipment is going to.";
    if (lines.length === 0) next.lines = "Add at least one item.";
    for (const line of lines) {
      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        next[line.itemId] = "Enter a whole number of 1 or more.";
      } else if (quantity > line.available) {
        next[line.itemId] = `Only ${line.available} available.`;
      }
    }
    const due = endOfDay(expected);
    if (due !== undefined && due < Date.now()) {
      next.expected = "The expected return date cannot be in the past.";
    }
    setFormErrors(next);
    setError(null);
    if (Object.keys(next).length === 0) setConfirmOpen(true);
  }

  async function submit() {
    if (!unitId) return;
    setPending(true);
    setError(null);
    try {
      await issue({
        unitId,
        memberId: memberId as Id<"memberships">,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          quantity: Number(line.quantity),
          condition: line.condition,
        })),
        expectedReturnAt: endOfDay(expected),
        note: note.trim() || undefined,
        requestKey,
      });
      setSuccess(`Issued ${lines.length} item${lines.length === 1 ? "" : "s"} to ${memberName}.`);
      setLines([]);
      setNote("");
      setExpected("");
      setRequestKey(crypto.randomUUID());
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
      setConfirmOpen(false);
    }
  }

  const summary = lines.map((line) => `${line.quantity} × ${line.name}`).join(", ");
  const due = endOfDay(expected);

  return (
    <>
      <PageHeader
        title="Issue equipment"
        description="Choose a member, add the items they are taking, and confirm."
        actions={
          <Link
            href="/operator/issuance/returns"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Returns and outstanding equipment
          </Link>
        }
      />
      {success ? (
        <p role="status" className="mb-4 text-sm text-green-700 dark:text-green-400">
          {success}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <form onSubmit={review} className="flex max-w-3xl flex-col gap-6" noValidate>
        <FormField label="Member" required error={formErrors.member}>
          {(props) => (
            <NativeSelect
              {...props}
              value={memberId}
              onChange={(event) => {
                setMemberId(event.target.value);
                setSuccess(null);
              }}
            >
              <option value="">Choose a member</option>
              {activeMembers.map((member) => (
                <option key={member.membershipId} value={member.membershipId}>
                  {member.displayName}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        {members.status === "CanLoadMore" ? (
          <div>
            <Button type="button" variant="outline" onClick={() => members.loadMore(100)}>
              Load more members
            </Button>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Find an item" hint="Search by name or asset tag.">
              {(props) => (
                <Input
                  {...props}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              )}
            </FormField>
            {search.trim() && results ? (
              results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching items.</p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Search results">
                  {results.map((item) => {
                    const issuable =
                      item.status === "available" &&
                      item.condition !== "unserviceable" &&
                      item.quantityAvailable > 0;
                    return (
                      <li
                        key={item._id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm"
                      >
                        <span>
                          {item.name}
                          {item.assetTag ? ` (${item.assetTag})` : ""} ·{" "}
                          {item.trackingMode === "bulk"
                            ? `${item.quantityAvailable} available`
                            : STATUS_LABELS[item.status]}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!issuable || lines.some((line) => line.itemId === item._id)}
                          aria-label={`Add ${item.name}`}
                          onClick={() => addItem(item)}
                        >
                          {issuable ? "Add" : "Unavailable"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}

            {formErrors.lines ? (
              <p role="alert" className="text-xs text-destructive">
                {formErrors.lines}
              </p>
            ) : null}
            {lines.length > 0 ? (
              <ul className="flex flex-col gap-3" aria-label="Items to issue">
                {lines.map((line) => (
                  <li
                    key={line.itemId}
                    className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_10rem_auto] sm:items-start"
                  >
                    <div className="text-sm">
                      <p className="font-medium">{line.name}</p>
                      <p className="text-muted-foreground">
                        {line.assetTag ? `${line.assetTag} · ` : ""}
                        {line.serialized ? "Serialized asset" : `${line.available} available`}
                      </p>
                    </div>
                    <FormField label="Quantity" error={formErrors[line.itemId]}>
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          min={1}
                          step={1}
                          disabled={line.serialized}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.itemId, { quantity: event.target.value })
                          }
                        />
                      )}
                    </FormField>
                    <FormField label="Condition at issue">
                      {(props) => (
                        <NativeSelect
                          {...props}
                          value={line.condition}
                          onChange={(event) =>
                            updateLine(line.itemId, { condition: event.target.value as Condition })
                          }
                        >
                          {ISSUE_CONDITIONS.map((condition) => (
                            <option key={condition} value={condition}>
                              {CONDITION_LABELS[condition]}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="sm:mt-6"
                      aria-label={`Remove ${line.name}`}
                      onClick={() =>
                        setLines((current) => current.filter((l) => l.itemId !== line.itemId))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Expected return date"
            hint="Leave blank to use the unit's default return period."
            error={formErrors.expected}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="Note">
            {(props) => (
              <Input
                {...props}
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </FormField>
        </div>

        <div>
          <Button type="submit" disabled={pending}>
            Review and issue
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Issue to ${memberName ?? "member"}?`}
        description={`${summary}. ${due ? `Due back ${formatDate(due)}. ` : ""}This is recorded in the audit history.`}
        confirmLabel="Issue equipment"
        pending={pending}
        onConfirm={submit}
      />
    </>
  );
}
