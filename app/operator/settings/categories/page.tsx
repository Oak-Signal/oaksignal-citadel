"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CUSTOM_ATTRIBUTE_TYPES } from "@/convex/lib/validators";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { useAccess } from "@/components/shared/AccessProvider";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { FormField } from "@/components/shared/FormField";
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
import { getErrorMessage } from "@/lib/errors";
import { customAttributeDefSchema, fieldErrors, textSchema } from "@/lib/validation";

type Category = Doc<"categories">;
type AttributeDraft = {
  key: string;
  label: string;
  type: (typeof CUSTOM_ATTRIBUTE_TYPES)[number];
  required: boolean;
  options: string;
};

const TYPE_LABELS: Record<AttributeDraft["type"], string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / no",
  date: "Date",
  select: "Choice list",
};

function toDraft(def: Category["customAttributeDefs"][number]): AttributeDraft {
  return { ...def, options: (def.options ?? []).join(", ") };
}

function slug(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "a_$1")
    .slice(0, 40);
}

function CategoryDialog({
  unitId,
  category,
  onClose,
}: {
  unitId: Id<"units">;
  category: Category | null;
  onClose: () => void;
}) {
  const create = useMutation(api.categories.create);
  const update = useMutation(api.categories.update);
  const [name, setName] = useState(category?.name ?? "");
  const [attributes, setAttributes] = useState<AttributeDraft[]>(
    (category?.customAttributeDefs ?? []).map(toDraft),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const change = (index: number, patch: Partial<AttributeDraft>) =>
    setAttributes((current) => current.map((a, i) => (i === index ? { ...a, ...patch } : a)));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const nameResult = textSchema("Name", 100).safeParse(name);
    if (!nameResult.success) found.name = nameResult.error.issues[0].message;

    const defs = attributes.map((draft, index) => {
      const options = draft.options
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean);
      const parsed = customAttributeDefSchema.safeParse({
        key: draft.key,
        label: draft.label,
        type: draft.type,
        required: draft.required,
        options: draft.type === "select" ? options : undefined,
      });
      if (!parsed.success) {
        for (const [field, message] of Object.entries(fieldErrors(parsed.error))) {
          found[`${index}.${field}`] = message;
        }
      } else if (draft.type === "select" && options.length === 0) {
        found[`${index}.options`] = "Add at least one option, separated by commas.";
      }
      return parsed.success ? parsed.data : null;
    });
    const keys = attributes.map((a) => a.key.trim());
    keys.forEach((key, index) => {
      if (key && keys.indexOf(key) !== index) found[`${index}.key`] = "Keys must be unique.";
    });
    if (Object.keys(found).length > 0 || !nameResult.success) {
      setErrors(found);
      return;
    }

    setPending(true);
    setErrors({});
    try {
      const customAttributeDefs = defs.filter((d) => d !== null);
      if (category) {
        await update({ categoryId: category._id, name: nameResult.data, customAttributeDefs });
      } else {
        await create({ unitId, name: nameResult.data, customAttributeDefs });
      }
      onClose();
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            Custom attributes add extra fields to the item form for every item in this category.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField label="Category name" required error={errors.name}>
            {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">Custom attributes</legend>
            {attributes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom attributes.</p>
            ) : null}
            {attributes.map((draft, index) => (
              <div key={index} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label={`Attribute ${index + 1} label`}
                    required
                    error={errors[`${index}.label`]}
                  >
                    {(props) => (
                      <Input
                        {...props}
                        value={draft.label}
                        onChange={(e) =>
                          change(index, {
                            label: e.target.value,
                            // Keep the key in step with the label until the user edits it.
                            ...(draft.key === slug(draft.label)
                              ? { key: slug(e.target.value) }
                              : {}),
                          })
                        }
                      />
                    )}
                  </FormField>
                  <FormField
                    label={`Attribute ${index + 1} key`}
                    hint="Lowercase letters, digits, underscores."
                    required
                    error={errors[`${index}.key`]}
                  >
                    {(props) => (
                      <Input
                        {...props}
                        value={draft.key}
                        onChange={(e) => change(index, { key: e.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField label={`Attribute ${index + 1} type`}>
                    {(props) => (
                      <NativeSelect
                        {...props}
                        value={draft.type}
                        onChange={(e) =>
                          change(index, { type: e.target.value as AttributeDraft["type"] })
                        }
                      >
                        {CUSTOM_ATTRIBUTE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {TYPE_LABELS[type]}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                  {draft.type === "select" ? (
                    <FormField
                      label={`Attribute ${index + 1} options`}
                      hint="Separate choices with commas."
                      error={errors[`${index}.options`]}
                    >
                      {(props) => (
                        <Input
                          {...props}
                          value={draft.options}
                          onChange={(e) => change(index, { options: e.target.value })}
                        />
                      )}
                    </FormField>
                  ) : null}
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={draft.required}
                      onChange={(e) => change(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`Remove attribute ${index + 1}`}
                    onClick={() =>
                      setAttributes((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setAttributes((current) => [
                    ...current,
                    { key: "", label: "", type: "text", required: false, options: "" },
                  ])
                }
              >
                Add attribute
              </Button>
            </div>
          </fieldset>

          {errors._form ? (
            <p role="alert" className="text-sm text-destructive">
              {errors._form}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CategoriesPage() {
  const { activeUnit } = useAccess();
  const can = useCan();
  const unitId = activeUnit?.unitId;
  const allowed = can("inventory.manage");
  const categories = useQuery(
    api.categories.list,
    unitId && allowed ? { unitId, includeArchived: true } : "skip",
  );
  const archive = useMutation(api.categories.archive);
  const restore = useMutation(api.categories.restore);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!unitId || !allowed) return <AccessDenied />;
  if (categories === undefined) return <Loading label="Loading categories..." />;

  async function toggle(category: Category) {
    setError(null);
    try {
      await (category.archived
        ? restore({ categoryId: category._id })
        : archive({ categoryId: category._id }));
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  const columns: Column<Category>[] = [
    { key: "name", header: "Name", cell: (row) => row.name },
    {
      key: "attributes",
      header: "Custom attributes",
      cell: (row) =>
        row.customAttributeDefs.length === 0
          ? "None"
          : row.customAttributeDefs.map((d) => d.label).join(", "),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.archived ? "outline" : "default"}>
          {row.archived ? "Archived" : "Active"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={`Edit ${row.name}`}
            onClick={() => setEditing(row)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={`${row.archived ? "Restore" : "Archive"} ${row.name}`}
            onClick={() => void toggle(row)}
          >
            {row.archived ? "Restore" : "Archive"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Item categories"
        description="Group items and define the extra details each category records."
        actions={
          <div className="flex gap-3">
            <Link
              href="/operator/inventory"
              className="self-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Back to inventory
            </Link>
            <Button onClick={() => setEditing("new")}>Add category</Button>
          </div>
        }
      />
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DataTable
        caption="Item categories"
        columns={columns}
        rows={categories}
        getRowId={(row) => row._id}
        emptyTitle="No categories yet"
        emptyDescription="Add a category before creating items."
      />
      {editing ? (
        <CategoryDialog
          unitId={unitId}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
