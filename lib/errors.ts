// Client-side error handling. Turns any thrown value into a safe message for the UI; internal
// details are never shown. Structured Convex errors carry a code and a user-safe message.
import { ConvexError } from "convex/values";
import { isAppErrorData, type AppErrorCode } from "@/convex/lib/errors";

export type UiError = { code: AppErrorCode | "UNKNOWN"; message: string };

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

export function toUiError(error: unknown): UiError {
  if (error instanceof ConvexError && isAppErrorData(error.data)) {
    return { code: error.data.code, message: error.data.message };
  }
  return { code: "UNKNOWN", message: FALLBACK_MESSAGE };
}

export function getErrorMessage(error: unknown): string {
  return toUiError(error).message;
}

export function isUnauthenticated(error: unknown): boolean {
  return toUiError(error).code === "UNAUTHENTICATED";
}
