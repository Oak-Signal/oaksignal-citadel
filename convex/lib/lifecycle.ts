// Record lifecycle metadata. Use these helpers instead of hand-writing timestamps so every
// record gets consistent `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, and `archived`.
// Tables adopt the fields they need; records are archived, never hard-deleted.
import type { Id } from "../_generated/dataModel";

export type LifecycleFields = {
  createdAt: number;
  updatedAt: number;
  createdBy: Id<"users">;
  updatedBy: Id<"users">;
  archived: boolean;
};

export function createStamp(userId: Id<"users">, now = Date.now()): LifecycleFields {
  return { createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId, archived: false };
}

export function updateStamp(userId: Id<"users">, now = Date.now()) {
  return { updatedAt: now, updatedBy: userId };
}

export function archiveStamp(userId: Id<"users">, now = Date.now()) {
  return { ...updateStamp(userId, now), archived: true };
}
