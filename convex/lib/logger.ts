/* eslint-disable no-console -- this module is the single sanctioned console writer */
// Structured logging for Convex functions. Output is JSON so it can be filtered in the Convex
// dashboard. Sensitive keys are redacted: never log secrets, tokens, or personal data (names,
// emails). Log opaque IDs for correlation instead.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = {
  function?: string;
  requestId?: string;
  unitId?: string;
  userId?: string;
  [key: string]: unknown;
};

const SENSITIVE_KEY = /secret|token|password|authorization|api[-_]?key|cookie|email|name|phone/i;
const MAX_DEPTH = 4;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(entry, depth + 1);
    }
    return result;
  }
  return value;
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
}

// Binds correlation fields once so later calls only pass event-specific data.
export function createLogger(base: LogFields) {
  return {
    debug: (event: string, fields: LogFields = {}) => log("debug", event, { ...base, ...fields }),
    info: (event: string, fields: LogFields = {}) => log("info", event, { ...base, ...fields }),
    warn: (event: string, fields: LogFields = {}) => log("warn", event, { ...base, ...fields }),
    error: (event: string, fields: LogFields = {}) => log("error", event, { ...base, ...fields }),
  };
}
