// Typed application errors with safe, user-facing messages (no internal details or secrets).
// Clients receive structured `ConvexError` data: `{ code, message }`.
import { ConvexError } from "convex/values";

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "UNAVAILABLE",
] as const;

export type AppErrorCode = (typeof ERROR_CODES)[number];

export type AppErrorData = { code: AppErrorCode; message: string };

export function appError(code: AppErrorCode, message: string): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}

// Deliberately generic so a denial reveals nothing about whether the unit, record, or
// membership exists.
export const unauthenticated = () => appError("UNAUTHENTICATED", "Sign in to continue.");
export const forbidden = () =>
  appError("FORBIDDEN", "You do not have access to perform this action.");
export const notFound = (what = "Record") => appError("NOT_FOUND", `${what} was not found.`);
export const validation = (message: string) => appError("VALIDATION", message);
export const conflict = (message: string) => appError("CONFLICT", message);
export const unavailable = (message: string) => appError("UNAVAILABLE", message);

export function isAppErrorData(data: unknown): data is AppErrorData {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.message === "string" &&
    (ERROR_CODES as readonly unknown[]).includes(candidate.code)
  );
}
