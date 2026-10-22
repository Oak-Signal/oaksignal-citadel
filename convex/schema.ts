// Schema conventions (apply to every table added to this file):
// - Every table declares validators for all fields; no `v.any()` for domain data.
// - Unit-owned tables carry a required `unitId: v.id("units")` and a `by_unit` (or `by_unit_and_*`) index.
// - Index names follow `by_<field>` or `by_<field1>_and_<field2>`, listing fields in index order.
// - Timestamps are epoch milliseconds (`v.number()`); Convex adds `_creationTime` automatically.
// - `transactions` and `auditLog` are append-only; corrections are new documents.
import { defineSchema } from "convex/server";

export default defineSchema({});
