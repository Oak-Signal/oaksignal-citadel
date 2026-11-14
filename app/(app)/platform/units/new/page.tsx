"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FormField } from "@/components/shared/FormField";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { fieldErrors, unitProvisionSchema } from "@/lib/validation";

// Provisions a unit and invites its first administrator. The same request key is reused for
// every submit of this form, so a double click cannot create two units.
export default function NewUnitPage() {
  const router = useRouter();
  const createUnit = useMutation(api.units.create);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState({
    name: "",
    identifier: "",
    firstAdminEmail: "",
    verificationNote: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = unitProvisionSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setPending(true);
    setErrors({});
    try {
      await createUnit({ ...parsed.data, requestKey });
      router.push("/platform");
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Provision a unit"
        description="Create the unit and invite its first administrator. Confirm the administrator's identity with the unit before you submit."
      />
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex max-w-xl flex-col gap-4"
        noValidate
      >
        <FormField label="Unit name" required error={errors.name}>
          {(props) => (
            <Input {...props} value={values.name} onChange={(e) => set("name")(e.target.value)} />
          )}
        </FormField>
        <FormField
          label="Unit identifier"
          required
          hint="Unique and permanent. Lowercase letters, digits and hyphens, for example sqn-1."
          error={errors.identifier}
        >
          {(props) => (
            <Input
              {...props}
              value={values.identifier}
              onChange={(e) => set("identifier")(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="First administrator's email"
          required
          hint="They sign in with this email and accept the invitation."
          error={errors.firstAdminEmail}
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="off"
              value={values.firstAdminEmail}
              onChange={(e) => set("firstAdminEmail")(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="How you verified the administrator"
          required
          hint="For example: confirmed with the commanding officer by phone on the unit's published number."
          error={errors.verificationNote}
        >
          {(props) => (
            <Input
              {...props}
              value={values.verificationNote}
              onChange={(e) => set("verificationNote")(e.target.value)}
            />
          )}
        </FormField>
        {errors._form ? (
          <p role="alert" className="text-sm text-destructive">
            {errors._form}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create unit"}
          </Button>
        </div>
      </form>
    </>
  );
}
