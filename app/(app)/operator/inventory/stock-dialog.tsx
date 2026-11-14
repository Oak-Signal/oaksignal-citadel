"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
import { fieldErrors, noteSchema, positiveQuantitySchema, textSchema } from "@/lib/validation";

export type StockMode = "receive" | "adjust";

const receiveSchema = z.object({ quantity: positiveQuantitySchema, note: noteSchema });
const adjustSchema = z.object({
  delta: z
    .number()
    .int("The adjustment must be a whole number.")
    .refine((value) => value !== 0, "Enter a change other than zero."),
  reason: textSchema("Reason", 2000),
});

// Records received stock or an authorized quantity adjustment for a bulk item. The server
// enforces inventory.manage (receive) or inventory.adjust (adjust) and requires a reason for
// adjustments. One request key per attempt makes a double-submit harmless.
export function StockDialog({
  unitId,
  itemId,
  itemName,
  mode,
  open,
  onOpenChange,
}: {
  unitId: Id<"units">;
  itemId: Id<"items">;
  itemName: string;
  mode: StockMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const receive = useMutation(api.transactions.receiveStock);
  const adjust = useMutation(api.transactions.adjustStock);
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const isReceive = mode === "receive";

  function close(next: boolean) {
    if (!next) {
      setAmount("");
      setText("");
      setErrors({});
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const number = amount.trim() === "" ? Number.NaN : Number(amount);
    const parsed = isReceive
      ? receiveSchema.safeParse({ quantity: number, note: text })
      : adjustSchema.safeParse({ delta: number, reason: text });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setPending(true);
    setErrors({});
    try {
      if (isReceive) {
        const data = parsed.data as z.infer<typeof receiveSchema>;
        await receive({
          unitId,
          itemId,
          quantity: data.quantity,
          note: data.note || undefined,
          requestKey,
        });
      } else {
        const data = parsed.data as z.infer<typeof adjustSchema>;
        await adjust({ unitId, itemId, delta: data.delta, reason: data.reason, requestKey });
      }
      setRequestKey(crypto.randomUUID());
      close(false);
    } catch (caught) {
      setErrors({ _form: getErrorMessage(caught) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isReceive ? "Receive stock" : "Adjust quantity"}</DialogTitle>
          <DialogDescription>
            {isReceive
              ? `Add newly received units of ${itemName} to stock.`
              : `Correct the quantity of ${itemName}. Use a negative number to reduce it. The change is recorded with your reason.`}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField
            label={isReceive ? "Quantity received" : "Change in quantity"}
            required
            error={errors.quantity ?? errors.delta}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            )}
          </FormField>
          <FormField
            label={isReceive ? "Note" : "Reason"}
            required={!isReceive}
            error={errors.note ?? errors.reason}
          >
            {(props) => (
              <Input {...props} value={text} onChange={(event) => setText(event.target.value)} />
            )}
          </FormField>
          {errors._form ? (
            <p role="alert" className="text-sm text-destructive">
              {errors._form}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isReceive ? "Receive stock" : "Apply adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
