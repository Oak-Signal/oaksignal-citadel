"use client";

import { FormField } from "@/components/shared/FormField";
import { NativeSelect } from "@/components/shared/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTION_LABELS, ENTITY_LABELS } from "./audit-labels";

export type AuditFilterValues = {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  from: string;
  to: string;
};

export const EMPTY_FILTERS: AuditFilterValues = {
  actorId: "",
  entityType: "",
  entityId: "",
  action: "",
  from: "",
  to: "",
};

export function AuditFilters({
  values,
  actors,
  onChange,
}: {
  values: AuditFilterValues;
  actors: { userId: string; name: string }[];
  onChange: (values: AuditFilterValues) => void;
}) {
  const set = (key: keyof AuditFilterValues, value: string) =>
    onChange({ ...values, [key]: value });
  const active = Object.values(values).some(Boolean);

  return (
    <form
      role="search"
      aria-label="Filter audit history"
      onSubmit={(event) => event.preventDefault()}
      className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <FormField label="Person">
        {(props) => (
          <NativeSelect
            {...props}
            value={values.actorId}
            onChange={(e) => set("actorId", e.target.value)}
          >
            <option value="">Everyone</option>
            {actors.map((actor) => (
              <option key={actor.userId} value={actor.userId}>
                {actor.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="Action">
        {(props) => (
          <NativeSelect
            {...props}
            value={values.action}
            onChange={(e) => set("action", e.target.value)}
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="Record type">
        {(props) => (
          <NativeSelect
            {...props}
            value={values.entityType}
            onChange={(e) => set("entityType", e.target.value)}
          >
            <option value="">All records</option>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="Record ID" hint="For example an item ID, to see that item's history.">
        {(props) => (
          <Input
            {...props}
            value={values.entityId}
            onChange={(e) => set("entityId", e.target.value.trim())}
          />
        )}
      </FormField>
      <FormField label="From">
        {(props) => (
          <Input
            {...props}
            type="date"
            value={values.from}
            max={values.to || undefined}
            onChange={(e) => set("from", e.target.value)}
          />
        )}
      </FormField>
      <FormField label="To">
        {(props) => (
          <Input
            {...props}
            type="date"
            value={values.to}
            min={values.from || undefined}
            onChange={(e) => set("to", e.target.value)}
          />
        )}
      </FormField>
      {active ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="button" variant="outline" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </form>
  );
}
