// Shared input validation (Zod). These schemas mirror the Convex validators in
// convex/lib/validators.ts; the server remains the source of truth and re-validates.
import { z } from "zod";
import { PERMISSIONS, ROLE_KEYS } from "@/convex/lib/permissions";
import { MAX_NOTE_LENGTH, MAX_REQUEST_KEY_LENGTH, MAX_TEXT_LENGTH } from "@/convex/lib/validators";

const trimmed = (label: string, max = MAX_TEXT_LENGTH) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const textSchema = (label: string, max?: number) => trimmed(label, max);

export const noteSchema = z
  .string()
  .trim()
  .max(MAX_NOTE_LENGTH, `Notes must be at most ${MAX_NOTE_LENGTH} characters.`);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const requestKeySchema = z.string().trim().min(1).max(MAX_REQUEST_KEY_LENGTH);

export const assetTagSchema = trimmed("Asset tag", 64);

export const quantitySchema = z
  .number()
  .int("Quantity must be a whole number.")
  .min(0, "Quantity cannot be negative.");

export const positiveQuantitySchema = quantitySchema.min(1, "Quantity must be at least 1.");

export const permissionSchema = z.enum(PERMISSIONS);
export const roleKeySchema = z.enum(ROLE_KEYS);

export const unitSettingsSchema = z.object({
  defaultReturnDays: z.number().int().min(1).max(365),
  retentionYears: z.number().int().min(1).max(50),
  lowStockNotifications: z.boolean(),
});

export const unitSchema = z.object({
  name: trimmed("Unit name"),
  identifier: trimmed("Unit identifier", 64),
});

export const inviteSchema = z.object({
  email: emailSchema,
  roles: z.array(roleKeySchema).min(1, "Choose at least one role."),
});

export const unitProvisionSchema = z.object({
  name: trimmed("Unit name", 120),
  identifier: z
    .string()
    .trim()
    .min(1, "Identifier is required.")
    .max(40, "Identifier must be at most 40 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, digits and single hyphens, for example sqn-1.",
    ),
  firstAdminEmail: emailSchema,
  verificationNote: trimmed("Verification note"),
});

export const unitSettingsFormSchema = unitSettingsSchema.extend({
  name: trimmed("Unit name", 120),
});

// Returns the first error message per field, ready to show beside form inputs.
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in result)) result[key] = issue.message;
  }
  return result;
}
