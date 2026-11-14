"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FormField } from "@/components/shared/FormField";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { emailSchema } from "@/lib/validation";

type UnitRow = { unitId: Id<"units">; name: string; identifier: string; status: string };
type GrantRow = {
  grantId: Id<"supportGrants">;
  unitId: Id<"units">;
  unitName: string;
  reason: string;
  expiresAt: number;
};

function SupportGrantForm({ units }: { units: UnitRow[] }) {
  const createGrant = useMutation(api.supportGrants.create);
  const [unitId, setUnitId] = useState("");
  const [verifierEmail, setVerifierEmail] = useState("");
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("4");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!unitId) next.unitId = "Choose a unit.";
    const email = emailSchema.safeParse(verifierEmail);
    if (!email.success) next.verifierEmail = "Enter the verifier's email address.";
    if (reason.trim().length === 0) next.reason = "A reason is required.";
    const durationHours = Number(hours);
    if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 72) {
      next.hours = "Enter a whole number of hours from 1 to 72.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0 || !email.success) return;

    setPending(true);
    setDone(false);
    try {
      await createGrant({
        unitId: unitId as Id<"units">,
        verifierEmail: email.data,
        reason: reason.trim(),
        durationHours,
      });
      setReason("");
      setVerifierEmail("");
      setDone(true);
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>Create a support grant</h2>
        </CardTitle>
        <CardDescription>
          Time-limited access to one unit for support. An Officer or Logistics Officer of that unit
          must be named as the verifier. Without a grant you cannot see any unit data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField label="Unit" required error={errors.unitId}>
            {(props) => (
              <select
                {...props}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select a unit</option>
                {units.map((unit) => (
                  <option key={unit.unitId} value={unit.unitId}>
                    {unit.name} ({unit.identifier})
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField
            label="Verifier's email"
            required
            hint="An active Officer or Logistics Officer in the unit."
            error={errors.verifierEmail}
          >
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="off"
                value={verifierEmail}
                onChange={(e) => setVerifierEmail(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Reason" required error={errors.reason}>
            {(props) => (
              <Input {...props} value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </FormField>
          <FormField label="Duration (hours)" hint="Up to 72 hours." error={errors.hours}>
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            )}
          </FormField>
          {errors._form ? (
            <p role="alert" className="text-sm text-destructive">
              {errors._form}
            </p>
          ) : null}
          {done ? (
            <p role="status" className="text-sm text-muted-foreground">
              Support grant created.
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create grant"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function PlatformPage() {
  const units = useQuery(api.units.listAll, {});
  const grants = useQuery(api.supportGrants.listMine, {});
  const revoke = useMutation(api.supportGrants.revoke);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(grantId: Id<"supportGrants">) {
    setError(null);
    try {
      await revoke({ grantId });
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  const unitColumns: Column<UnitRow>[] = [
    { key: "name", header: "Unit", cell: (row) => row.name },
    { key: "identifier", header: "Identifier", cell: (row) => row.identifier },
    {
      key: "status",
      header: "Status",
      cell: (row) => <Badge variant="secondary">{row.status}</Badge>,
    },
  ];
  const grantColumns: Column<GrantRow>[] = [
    { key: "unit", header: "Unit", cell: (row) => row.unitName },
    { key: "reason", header: "Reason", cell: (row) => row.reason },
    {
      key: "expires",
      header: "Expires",
      cell: (row) =>
        row.expiresAt > Date.now() ? new Date(row.expiresAt).toLocaleString() : "Expired",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Revoke grant for ${row.unitName}`}
          onClick={() => void handleRevoke(row.grantId)}
        >
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="units-heading">
        <PageHeader
          title="Units"
          description="Units on the platform. You can see that a unit exists, never its data."
          actions={
            <Link href="/platform/units/new" className={buttonVariants()}>
              Provision a unit
            </Link>
          }
        />
        <h2 id="units-heading" className="sr-only">
          All units
        </h2>
        {units === undefined ? (
          <Loading label="Loading units..." />
        ) : (
          <DataTable
            caption="Units on the platform"
            columns={unitColumns}
            rows={units}
            getRowId={(row) => row.unitId}
            emptyTitle="No units yet"
            emptyDescription="Provision the first unit to get started."
          />
        )}
      </section>

      <section aria-labelledby="grants-heading" className="flex flex-col gap-4">
        <h2 id="grants-heading" className="text-xl font-semibold">
          Support grants
        </h2>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {grants === undefined ? (
          <Loading label="Loading grants..." />
        ) : (
          <DataTable
            caption="Your support grants"
            columns={grantColumns}
            rows={grants}
            getRowId={(row) => row.grantId}
            emptyTitle="No active grants"
          />
        )}
        {units ? <SupportGrantForm units={units} /> : null}
      </section>
    </div>
  );
}
