"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/shared/AppShell";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { FormField } from "@/components/shared/FormField";
import { Loading } from "@/components/shared/Loading";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionGate, PermissionProvider } from "@/components/shared/PermissionGate";
import { NAV_CONFIG } from "@/components/shared/nav-config";

const rows = [
  { id: "1", name: "Radio, handheld", status: "Available" },
  { id: "2", name: "Tent, 4-person", status: "Issued" },
];

export function DesignPreview() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <PermissionProvider
      grants={{ roles: ["civilian_staff"], extraPermissions: [], revokedPermissions: [] }}
    >
      <AppShell
        portal="operator"
        navItems={NAV_CONFIG.operator}
        accountMenu={
          <Button variant="outline" size="sm">
            Account
          </Button>
        }
      >
        <PageHeader
          title="Design preview"
          description="Shared components used across CITADEL."
          actions={<Button onClick={() => setConfirmOpen(true)}>Open confirm dialog</Button>}
        />

        <div className="grid gap-8">
          <section aria-labelledby="forms-heading" className="grid max-w-md gap-4">
            <h2 id="forms-heading" className="text-lg font-medium">
              Form field
            </h2>
            <FormField label="Asset tag" hint="Printed on the item label." required>
              {(props) => <Input {...props} />}
            </FormField>
            <FormField label="Quantity" error="Quantity must be a whole number.">
              {(props) => <Input {...props} defaultValue="1.5" />}
            </FormField>
          </section>

          <section aria-labelledby="table-heading" className="grid gap-4">
            <h2 id="table-heading" className="text-lg font-medium">
              Data table
            </h2>
            <DataTable
              caption="Sample inventory"
              rows={rows}
              getRowId={(row) => row.id}
              columns={[
                { key: "name", header: "Item", cell: (row) => row.name },
                { key: "status", header: "Status", cell: (row) => row.status },
              ]}
            />
          </section>

          <section aria-labelledby="states-heading" className="grid gap-4">
            <h2 id="states-heading" className="text-lg font-medium">
              States
            </h2>
            <Loading label="Loading inventory..." />
            <EmptyState title="No items yet" description="Add your first item to get started." />
            <ErrorState />
            <PermissionGate
              permission="audit.view"
              fallback={<p>Audit link hidden: no audit.view.</p>}
            >
              <p>Visible only with audit.view.</p>
            </PermissionGate>
          </section>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Archive this item?"
          description="Archived items stay in the history but can no longer be issued."
          confirmLabel="Archive"
          destructive
          onConfirm={() => setConfirmOpen(false)}
        />
      </AppShell>
    </PermissionProvider>
  );
}
