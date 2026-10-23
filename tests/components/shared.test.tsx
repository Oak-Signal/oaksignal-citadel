import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { FormField } from "@/components/shared/FormField";
import { PermissionGate, PermissionProvider } from "@/components/shared/PermissionGate";

describe("FormField", () => {
  it("links the label, hint, and error to the control", () => {
    render(
      <FormField label="Asset tag" hint="On the label" error="Required">
        {(props) => <input {...props} />}
      </FormField>,
    );
    const input = screen.getByLabelText("Asset tag");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

describe("DataTable", () => {
  it("renders a captioned table with column headers", () => {
    render(
      <DataTable
        caption="Items"
        rows={[{ id: "1", name: "Radio" }]}
        getRowId={(row) => row.id}
        columns={[{ key: "name", header: "Item", cell: (row) => row.name }]}
      />,
    );
    expect(screen.getByRole("table", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Item" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Radio" })).toBeInTheDocument();
  });

  it("shows an empty state with no rows", () => {
    render(
      <DataTable
        caption="Items"
        rows={[]}
        getRowId={() => ""}
        columns={[]}
        emptyTitle="No items"
      />,
    );
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("PermissionGate", () => {
  const grants = { roles: ["junior_cadet"], extraPermissions: [], revokedPermissions: [] };

  it("hides content without the permission", () => {
    render(
      <PermissionProvider grants={grants}>
        <PermissionGate permission="audit.view" fallback={<p>denied</p>}>
          <p>secret</p>
        </PermissionGate>
      </PermissionProvider>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText("denied")).toBeInTheDocument();
  });

  it("shows content with the permission", () => {
    render(
      <PermissionProvider grants={grants}>
        <PermissionGate permission="requests.submit">
          <p>form</p>
        </PermissionGate>
      </PermissionProvider>,
    );
    expect(screen.getByText("form")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("runs the action on confirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Archive?"
        description="Cannot be issued."
        confirmLabel="Archive"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
