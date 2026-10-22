// Typed application errors with safe, user-facing messages (no internal details or secrets).
import { ConvexError } from "convex/values";

export type AppErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "CONFLICT";

export function appError(
  code: AppErrorCode,
  message: string,
): ConvexError<{
  code: AppErrorCode;
  message: string;
}> {
  return new ConvexError({ code, message });
}
