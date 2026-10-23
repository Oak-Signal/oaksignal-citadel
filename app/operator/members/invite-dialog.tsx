"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/convex/lib/permissions";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { fieldErrors, inviteSchema } from "@/lib/validation";

// Invites someone by email. The server requires members.manage; the invitee accepts after
// signing in with that email.
export function InviteDialog({
  unitId,
  open,
  onOpenChange,
}: {
  unitId: Id<"units">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invite = useMutation(api.memberships.invite);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<RoleKey[]>(["junior_cadet"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function toggle(role: RoleKey) {
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = inviteSchema.safeParse({ email, roles });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setPending(true);
    setErrors({});
    try {
      await invite({ unitId, email: parsed.data.email, roles: parsed.data.roles });
      setEmail("");
      setRoles(["junior_cadet"]);
      onOpenChange(false);
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            They join this unit with the roles you choose once they sign in with this email and
            accept.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField label="Email address" required error={errors.email}>
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </FormField>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Roles</legend>
            {ROLE_KEYS.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={roles.includes(role)}
                  onChange={() => toggle(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
            {errors.roles ? (
              <p role="alert" className="text-xs text-destructive">
                {errors.roles}
              </p>
            ) : null}
          </fieldset>
          {errors._form ? (
            <p role="alert" className="text-sm text-destructive">
              {errors._form}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
