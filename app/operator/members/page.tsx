"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/convex/lib/permissions";
import { useAccess } from "@/components/shared/AccessProvider";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCan } from "@/components/shared/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/errors";
import { roleLabel } from "@/lib/permissions";
import { InviteDialog } from "./invite-dialog";

type MemberRow = {
  membershipId: Id<"memberships">;
  displayName: string;
  email?: string;
  roles: string[];
  status: "invited" | "active" | "inactive";
  outstandingAssignments?: number;
};

type Action =
  | { kind: "roles"; member: MemberRow }
  | { kind: "deactivate"; member: MemberRow }
  | { kind: "appoint"; member: MemberRow };

function RolesDialog({
  member,
  onClose,
  onError,
}: {
  member: MemberRow;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const setRoles = useMutation(api.memberships.setRoles);
  const [roles, setSelected] = useState<RoleKey[]>(
    member.roles.filter((role): role is RoleKey => (ROLE_KEYS as readonly string[]).includes(role)),
  );
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await setRoles({ membershipId: member.membershipId, roles });
      onClose();
    } catch (caught) {
      onError(getErrorMessage(caught));
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roles for {member.displayName}</DialogTitle>
          <DialogDescription>A member can hold several roles at once.</DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Roles</legend>
          {ROLE_KEYS.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={roles.includes(role)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(role)
                      ? current.filter((item) => item !== role)
                      : [...current, role],
                  )
                }
              />
              {ROLE_LABELS[role]}
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || roles.length === 0} onClick={() => void save()}>
            {pending ? "Saving..." : "Save roles"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MembersPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const canManage = can("members.manage");
  const canView = canManage || can("members.viewAssignments");
  const unitId = activeUnit?.unitId;

  const { results, status, loadMore } = usePaginatedQuery(
    api.memberships.list,
    unitId && canView ? { unitId } : "skip",
    { initialNumItems: 25 },
  );
  const deactivate = useMutation(api.memberships.deactivate);
  const appointAdmin = useMutation(api.memberships.appointAdmin);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!unitId || !canView) return <AccessDenied />;

  async function confirm() {
    if (!action || action.kind === "roles") return;
    setPending(true);
    setError(null);
    try {
      if (action.kind === "deactivate") {
        await deactivate({ membershipId: action.member.membershipId });
      } else {
        await appointAdmin({ membershipId: action.member.membershipId });
      }
      setAction(null);
    } catch (caught) {
      setError(getErrorMessage(caught));
      setAction(null);
    } finally {
      setPending(false);
    }
  }

  const rows = results as MemberRow[];
  const columns: Column<MemberRow>[] = [
    { key: "name", header: "Name", cell: (row) => row.displayName },
    ...(canManage
      ? [{ key: "email", header: "Email", cell: (row: MemberRow) => row.email ?? "" }]
      : []),
    { key: "roles", header: "Roles", cell: (row) => row.roles.map(roleLabel).join(", ") },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge>
      ),
    },
    ...(can("members.viewAssignments")
      ? [
          {
            key: "outstanding",
            header: "Outstanding items",
            cell: (row: MemberRow) => row.outstandingAssignments ?? 0,
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (row: MemberRow) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Edit roles for ${row.displayName}`}
                  onClick={() => setAction({ kind: "roles", member: row })}
                >
                  Roles
                </Button>
                {row.status === "active" && !row.roles.includes("unit_admin") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Make ${row.displayName} an administrator`}
                    onClick={() => setAction({ kind: "appoint", member: row })}
                  >
                    Make admin
                  </Button>
                ) : null}
                {row.status !== "inactive" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    aria-label={`Deactivate ${row.displayName}`}
                    onClick={() => setAction({ kind: "deactivate", member: row })}
                  >
                    Deactivate
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Members"
        description="Everyone in this unit, including inactive members whose equipment is still on record."
        actions={
          canManage ? <Button onClick={() => setInviteOpen(true)}>Invite member</Button> : undefined
        }
      />
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status === "LoadingFirstPage" ? (
        <Loading label="Loading members..." />
      ) : (
        <DataTable
          caption="Unit members"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.membershipId}
          emptyTitle="No members yet"
        />
      )}
      {status === "CanLoadMore" ? (
        <div className="mt-4">
          <Button variant="outline" onClick={() => loadMore(25)}>
            Load more
          </Button>
        </div>
      ) : null}

      <InviteDialog unitId={unitId} open={inviteOpen} onOpenChange={setInviteOpen} />
      {action?.kind === "roles" ? (
        <RolesDialog member={action.member} onClose={() => setAction(null)} onError={setError} />
      ) : null}
      <ConfirmDialog
        open={action?.kind === "deactivate" || action?.kind === "appoint"}
        onOpenChange={(open) => (open ? undefined : setAction(null))}
        title={
          action?.kind === "appoint"
            ? `Make ${action.member.displayName} an administrator?`
            : `Deactivate ${action?.member.displayName ?? "member"}?`
        }
        description={
          action?.kind === "appoint"
            ? "Administrators can manage members, roles and unit settings."
            : "They lose access immediately. Their history and any equipment issued to them stay on record."
        }
        confirmLabel={action?.kind === "appoint" ? "Make administrator" : "Deactivate"}
        destructive={action?.kind === "deactivate"}
        pending={pending}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
