"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PERMISSIONS } from "@/convex/lib/permissions";
import { useAccess } from "@/components/shared/AccessProvider";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/errors";

type RoleRow = {
  key: string;
  name: string;
  defaultPermissions: string[];
  permissions: string[];
  overridden: boolean;
};

function RoleCard({ unitId, role }: { unitId: Id<"units">; role: RoleRow }) {
  const update = useMutation(api.roles.update);
  const reset = useMutation(api.roles.reset);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = draft ?? role.permissions;

  async function run(task: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await task();
      setDraft(null);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <h2>{role.name}</h2>
          {role.overridden ? <Badge variant="secondary">Customised</Badge> : null}
        </CardTitle>
        <CardDescription>Permissions this role grants in your unit.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Permissions for {role.name}</legend>
          {PERMISSIONS.map((permission) => (
            <label key={permission} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={current.includes(permission)}
                onChange={() =>
                  setDraft(
                    current.includes(permission)
                      ? current.filter((item) => item !== permission)
                      : [...current, permission],
                  )
                }
              />
              {permission}
            </label>
          ))}
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || draft === null}
            onClick={() =>
              void run(() =>
                update({
                  unitId,
                  key: role.key,
                  permissions: current as (typeof PERMISSIONS)[number][],
                }),
              )
            }
          >
            Save {role.name}
          </Button>
          {role.overridden ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => void run(() => reset({ unitId, key: role.key }))}
            >
              Reset to default
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RolesPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("roles.manage");
  const roles = useQuery(api.roles.list, unitId && allowed ? { unitId } : "skip");

  if (!unitId || !allowed) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Role permissions"
        description="Adjust what each role can do in this unit. Platform administration is separate and cannot be granted here."
        actions={
          <Link
            href="/operator/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to settings
          </Link>
        }
      />
      {roles === undefined ? (
        <Loading label="Loading roles..." />
      ) : (
        <div className="flex flex-col gap-4">
          {roles.map((role) => (
            <RoleCard key={`${role.key}-${role.permissions.join()}`} unitId={unitId} role={role} />
          ))}
        </div>
      )}
    </>
  );
}
