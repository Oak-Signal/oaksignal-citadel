"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ITEM_CONDITIONS, ITEM_STATUSES } from "@/convex/lib/validators";
import { FormField } from "@/components/shared/FormField";
import { NativeSelect } from "@/components/shared/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { fieldErrors, itemFormSchema } from "@/lib/validation";

export const STATUS_LABELS: Record<Doc<"items">["status"], string> = {
  available: "Available",
  issued: "Issued",
  reserved: "Reserved",
  damaged: "Damaged",
  missing: "Missing",
  unserviceable: "Unserviceable",
  maintenance: "In maintenance",
  retired: "Retired",
};

export const CONDITION_LABELS: Record<Doc<"items">["condition"], string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unserviceable: "Unserviceable",
};

// `issued` and `reserved` are set by issuance and requests, never by hand.
const MANUAL_STATUSES = ITEM_STATUSES.filter((s) => s !== "issued" && s !== "reserved");

type AttributeValues = Record<string, string | number | boolean>;

const text = (value: string | undefined) => value ?? "";

// Create and edit form for one catalogue item. Category-defined custom attributes are rendered
// and checked here; the server validates them again against the same definitions.
export function ItemForm({
  unitId,
  categories,
  item,
  onDone,
  onCancel,
}: {
  unitId: Id<"units">;
  categories: Doc<"categories">[];
  item?: Doc<"items">;
  onDone: (itemId: Id<"items">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.items.create);
  const update = useMutation(api.items.update);
  const editing = item !== undefined;

  const [values, setValues] = useState({
    name: text(item?.name),
    categoryId: item?.categoryId ?? "",
    trackingMode: item?.trackingMode ?? "serialized",
    condition: item?.condition ?? "good",
    status: item?.status ?? "available",
    assetTag: text(item?.assetTag),
    serialNumber: text(item?.serialNumber),
    sku: text(item?.sku),
    barcode: text(item?.barcode),
    supplier: text(item?.supplier),
    locationId: text(item?.locationId),
    description: text(item?.description),
    notes: text(item?.notes),
    restricted: item?.restricted ?? false,
    quantityOnHand: item ? String(item.quantityOnHand) : "",
    minThreshold: item?.minThreshold === undefined ? "" : String(item.minThreshold),
  });
  const [attributes, setAttributes] = useState<AttributeValues>(item?.customAttributes ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const category = categories.find((c) => c._id === values.categoryId);
  const bulk = values.trackingMode === "bulk";
  const locked = item?.status === "issued" || item?.status === "reserved";
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function checkAttributes(): Record<string, string> {
    const found: Record<string, string> = {};
    for (const def of category?.customAttributeDefs ?? []) {
      const value = attributes[def.key];
      const empty = value === undefined || value === "";
      if (empty && def.required) found[`attr.${def.key}`] = `${def.label} is required.`;
    }
    return found;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = itemFormSchema.safeParse({
      ...values,
      quantityOnHand: values.quantityOnHand === "" ? undefined : Number(values.quantityOnHand),
      minThreshold: values.minThreshold === "" ? undefined : Number(values.minThreshold),
    });
    const attributeErrors = checkAttributes();
    if (!parsed.success || Object.keys(attributeErrors).length > 0) {
      setErrors({ ...(parsed.success ? {} : fieldErrors(parsed.error)), ...attributeErrors });
      return;
    }
    const data = parsed.data;
    const customAttributes: AttributeValues = {};
    for (const def of category?.customAttributeDefs ?? []) {
      const value = attributes[def.key];
      if (value !== undefined && value !== "") customAttributes[def.key] = value;
    }
    setPending(true);
    setErrors({});
    try {
      if (item) {
        await update({
          itemId: item._id,
          name: data.name,
          description: data.description,
          categoryId: data.categoryId as Id<"categories">,
          sku: data.sku,
          assetTag: data.assetTag,
          serialNumber: data.serialNumber,
          barcode: data.barcode,
          supplier: data.supplier,
          condition: data.condition,
          status: locked ? undefined : data.status,
          locationId: data.locationId === "" ? null : data.locationId,
          restricted: data.restricted,
          minThreshold: bulk ? (data.minThreshold ?? null) : undefined,
          customAttributes,
          notes: data.notes,
        });
        onDone(item._id);
      } else {
        const id = await create({
          unitId,
          name: data.name,
          description: data.description,
          categoryId: data.categoryId as Id<"categories">,
          trackingMode: data.trackingMode,
          sku: data.sku,
          assetTag: data.assetTag,
          serialNumber: data.serialNumber,
          barcode: data.barcode,
          supplier: data.supplier,
          condition: data.condition,
          status: data.status,
          locationId: data.locationId,
          restricted: data.restricted,
          quantityOnHand: bulk ? data.quantityOnHand : undefined,
          minThreshold: bulk ? data.minThreshold : undefined,
          customAttributes,
          notes: data.notes,
        });
        onDone(id);
      }
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
      <FormField label="Name" required error={errors.name}>
        {(props) => (
          <Input {...props} value={values.name} onChange={(e) => set("name", e.target.value)} />
        )}
      </FormField>
      <FormField label="Category" required error={errors.categoryId}>
        {(props) => (
          <NativeSelect
            {...props}
            value={values.categoryId}
            onChange={(e) => set("categoryId", e.target.value as Id<"categories">)}
          >
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField
        label="Tracking"
        hint={editing ? "Tracking cannot be changed after an item is created." : undefined}
      >
        {(props) => (
          <NativeSelect
            {...props}
            value={values.trackingMode}
            disabled={editing}
            onChange={(e) => set("trackingMode", e.target.value as "serialized" | "bulk")}
          >
            <option value="serialized">Serialized asset (one unit)</option>
            <option value="bulk">Bulk stock (counted quantity)</option>
          </NativeSelect>
        )}
      </FormField>
      {!bulk ? (
        <>
          <FormField label="Asset tag" hint="Unique within your unit." error={errors.assetTag}>
            {(props) => (
              <Input
                {...props}
                value={values.assetTag}
                onChange={(e) => set("assetTag", e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Serial number" error={errors.serialNumber}>
            {(props) => (
              <Input
                {...props}
                value={values.serialNumber}
                onChange={(e) => set("serialNumber", e.target.value)}
              />
            )}
          </FormField>
        </>
      ) : (
        <>
          {!editing ? (
            <FormField label="Quantity on hand" required error={errors.quantityOnHand}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={values.quantityOnHand}
                  onChange={(e) => set("quantityOnHand", e.target.value)}
                />
              )}
            </FormField>
          ) : null}
          <FormField
            label="Low-stock threshold"
            hint="Flag this item when the available quantity drops below this number."
            error={errors.minThreshold}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={0}
                value={values.minThreshold}
                onChange={(e) => set("minThreshold", e.target.value)}
              />
            )}
          </FormField>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="SKU" error={errors.sku}>
          {(props) => (
            <Input {...props} value={values.sku} onChange={(e) => set("sku", e.target.value)} />
          )}
        </FormField>
        <FormField label="Barcode" error={errors.barcode}>
          {(props) => (
            <Input
              {...props}
              value={values.barcode}
              onChange={(e) => set("barcode", e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Condition" required>
          {(props) => (
            <NativeSelect
              {...props}
              value={values.condition}
              onChange={(e) => set("condition", e.target.value as typeof values.condition)}
            >
              {ITEM_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {CONDITION_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          label="Status"
          hint={locked ? "Return or release this item to change its status." : undefined}
        >
          {(props) => (
            <NativeSelect
              {...props}
              value={values.status}
              disabled={locked}
              onChange={(e) => set("status", e.target.value as typeof values.status)}
            >
              {(locked ? ITEM_STATUSES : MANUAL_STATUSES).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label="Location" error={errors.locationId}>
          {(props) => (
            <Input
              {...props}
              value={values.locationId}
              onChange={(e) => set("locationId", e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Supplier" error={errors.supplier}>
          {(props) => (
            <Input
              {...props}
              value={values.supplier}
              onChange={(e) => set("supplier", e.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField label="Description" error={errors.description}>
        {(props) => (
          <Input
            {...props}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Notes" error={errors.notes}>
        {(props) => (
          <Input {...props} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
        )}
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={values.restricted}
          onChange={(e) => set("restricted", e.target.checked)}
        />
        Restricted item (issuing needs approval)
      </label>

      {category && category.customAttributeDefs.length > 0 ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">{category.name} details</legend>
          {category.customAttributeDefs.map((def) => {
            const error = errors[`attr.${def.key}`];
            const value = attributes[def.key];
            const setValue = (next: string | number | boolean) =>
              setAttributes((current) => ({ ...current, [def.key]: next }));
            if (def.type === "boolean") {
              return (
                <label key={def.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={value === true}
                    onChange={(e) => setValue(e.target.checked)}
                  />
                  {def.label}
                </label>
              );
            }
            return (
              <FormField key={def.key} label={def.label} required={def.required} error={error}>
                {(props) =>
                  def.type === "select" ? (
                    <NativeSelect
                      {...props}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => setValue(e.target.value)}
                    >
                      <option value="">Choose...</option>
                      {(def.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      {...props}
                      type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
                      value={value === undefined ? "" : String(value)}
                      onChange={(e) =>
                        def.type === "number" && e.target.value !== ""
                          ? setValue(Number(e.target.value))
                          : setValue(e.target.value)
                      }
                    />
                  )
                }
              </FormField>
            );
          })}
        </fieldset>
      ) : null}

      {errors._form ? (
        <p role="alert" className="text-sm text-destructive">
          {errors._form}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : editing ? "Save changes" : "Create item"}
        </Button>
      </div>
    </form>
  );
}
