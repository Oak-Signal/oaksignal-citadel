"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAccess } from "@/components/shared/AccessProvider";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { FormField } from "@/components/shared/FormField";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionGate, useCan } from "@/components/shared/PermissionGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toCsv } from "@/lib/csv";
import { getErrorMessage } from "@/lib/errors";
import { roleLabel } from "@/lib/permissions";
import { fieldErrors, unitSettingsFormSchema } from "@/lib/validation";

function SettingsForm({ unitId }: { unitId: Id<"units"> }) {
  const unit = useQuery(api.units.get, { unitId });
  const update = useMutation(api.units.updateSettings);
  const [draft, setDraft] = useState<Record<string, string | boolean> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  if (unit === undefined) return <Loading label="Loading settings..." />;

  const values = draft ?? {
    name: unit.name,
    defaultReturnDays: String(unit.settings.defaultReturnDays),
    retentionYears: String(unit.settings.retentionYears),
    lowStockNotifications: unit.settings.lowStockNotifications,
  };
  const set = (key: string, value: string | boolean) => {
    setSaved(false);
    setDraft({ ...values, [key]: value });
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = unitSettingsFormSchema.safeParse({
      name: values.name,
      defaultReturnDays: Number(values.defaultReturnDays),
      retentionYears: Number(values.retentionYears),
      lowStockNotifications: values.lowStockNotifications,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setPending(true);
    setErrors({});
    try {
      await update({ unitId, ...parsed.data });
      setSaved(true);
      setDraft(null);
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex max-w-xl flex-col gap-4"
      noValidate
    >
      <FormField label="Unit name" required error={errors.name}>
        {(props) => (
          <Input
            {...props}
            value={String(values.name)}
            onChange={(e) => set("name", e.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="Default return period (days)"
        hint="Used when equipment is issued without a specific return date."
        error={errors.defaultReturnDays}
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            value={String(values.defaultReturnDays)}
            onChange={(e) => set("defaultReturnDays", e.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="Retention period (years)"
        hint="Personal details of former members are anonymized after this period. Default is 7 years."
        error={errors.retentionYears}
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            value={String(values.retentionYears)}
            onChange={(e) => set("retentionYears", e.target.value)}
          />
        )}
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={values.lowStockNotifications === true}
          onChange={(e) => set("lowStockNotifications", e.target.checked)}
        />
        Send low-stock notifications to staff
      </label>
      {errors._form ? (
        <p role="alert" className="text-sm text-destructive">
          {errors._form}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Settings saved.
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function ExportTools({ unitId }: { unitId: Id<"units"> }) {
  const convex = useConvex();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportMembers() {
    setPending(true);
    setError(null);
    try {
      const lines: unknown[][] = [];
      let cursor: string | null = null;
      for (;;) {
        const page: Awaited<ReturnType<typeof convex.query<typeof api.memberships.list>>> =
          await convex.query(api.memberships.list, {
            unitId,
            paginationOpts: { numItems: 100, cursor },
          });
        for (const row of page.page) {
          lines.push([
            row.displayName,
            row.email ?? "",
            row.roles.map(roleLabel).join("; "),
            row.status,
          ]);
        }
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      const csv = toCsv(["Name", "Email", "Roles", "Status"], lines);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "members.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>Export tools</h2>
        </CardTitle>
        <CardDescription>
          Download your unit&apos;s data. Inventory and transaction exports arrive with those
          features; bulk import is not part of this release.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <Button variant="outline" disabled={pending} onClick={() => void exportMembers()}>
            {pending ? "Preparing..." : "Export members (CSV)"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  if (!activeUnit || !can("unit.settings")) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Unit settings"
        description="Profile, return periods, retention and notifications for this unit."
        actions={
          <PermissionGate permission="roles.manage">
            <Link
              href="/operator/settings/roles"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Manage role permissions
            </Link>
          </PermissionGate>
        }
      />
      <div className="flex flex-col gap-8">
        <SettingsForm unitId={activeUnit.unitId} />
        <PermissionGate permission="members.manage">
          <ExportTools unitId={activeUnit.unitId} />
        </PermissionGate>
      </div>
    </>
  );
}
