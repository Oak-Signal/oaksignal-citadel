// Shared argument and field validators for Convex functions. lib/validation.ts holds the
// matching Zod schemas used by forms; keep the two in step.
import { v } from "convex/values";
import { PERMISSIONS, ROLE_KEYS } from "./permissions";
import { validation } from "./errors";

export const MAX_TEXT_LENGTH = 500;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_REQUEST_KEY_LENGTH = 100;

type LiteralValidator<T extends string> = ReturnType<typeof v.literal<T>>;

function literalUnion<T extends string>(values: readonly T[]) {
  return v.union(...(values.map((value) => v.literal(value)) as [LiteralValidator<T>]));
}

export const permissionValidator = literalUnion(PERMISSIONS);
export const roleKeyValidator = literalUnion(ROLE_KEYS);

export const unitStatusValidator = v.union(v.literal("active"), v.literal("archived"));
export const membershipStatusValidator = v.union(
  v.literal("invited"),
  v.literal("active"),
  v.literal("inactive"),
);

export const unitSettingsValidator = v.object({
  defaultReturnDays: v.number(),
  retentionYears: v.number(),
  lowStockNotifications: v.boolean(),
});

export const DEFAULT_UNIT_SETTINGS = {
  defaultReturnDays: 14,
  retentionYears: 7,
  lowStockNotifications: true,
} as const;

export const transactionTypeValidator = v.union(
  v.literal("issue"),
  v.literal("return"),
  v.literal("receive"),
  v.literal("adjust"),
  v.literal("transfer"),
  v.literal("correction"),
  v.literal("dispose"),
);

export const assignmentStatusValidator = v.union(
  v.literal("open"),
  v.literal("partially_returned"),
  v.literal("closed"),
  v.literal("overdue"),
);

export const trackingModeValidator = v.union(v.literal("serialized"), v.literal("bulk"));

export const ITEM_STATUSES = [
  "available",
  "issued",
  "reserved",
  "damaged",
  "missing",
  "unserviceable",
  "maintenance",
  "retired",
] as const;
export const itemStatusValidator = literalUnion(ITEM_STATUSES);

export const ITEM_CONDITIONS = ["new", "good", "fair", "poor", "unserviceable"] as const;
export const itemConditionValidator = literalUnion(ITEM_CONDITIONS);

export const CUSTOM_ATTRIBUTE_TYPES = ["text", "number", "boolean", "date", "select"] as const;
export const customAttributeDefValidator = v.object({
  key: v.string(),
  label: v.string(),
  type: literalUnion(CUSTOM_ATTRIBUTE_TYPES),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
});

export const customAttributeValueValidator = v.union(v.string(), v.number(), v.boolean());

export const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.optional(v.string()),
  size: v.optional(v.number()),
});

// Server-side input checks that Convex validators cannot express.
export function requireText(value: string, field: string, max = MAX_TEXT_LENGTH): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw validation(`${field} is required.`);
  if (trimmed.length > max) throw validation(`${field} must be at most ${max} characters.`);
  return trimmed;
}

export function assertValidSettings(settings: {
  defaultReturnDays: number;
  retentionYears: number;
}): void {
  const { defaultReturnDays, retentionYears } = settings;
  if (!Number.isInteger(defaultReturnDays) || defaultReturnDays < 1 || defaultReturnDays > 365) {
    throw validation("Default return days must be a whole number from 1 to 365.");
  }
  if (!Number.isInteger(retentionYears) || retentionYears < 1 || retentionYears > 50) {
    throw validation("Retention years must be a whole number from 1 to 50.");
  }
}

export function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw validation(`${field} must be a whole number of zero or more.`);
  }
}
