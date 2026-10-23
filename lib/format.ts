// Date and number formatting helpers. Dates are stored as epoch milliseconds.
const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  return dateTimeFormatter.format(new Date(timestamp));
}

export function addDays(timestamp: number, days: number): number {
  return timestamp + days * DAY_MS;
}

export function isOverdue(expectedReturnAt: number | undefined, now = Date.now()): boolean {
  return expectedReturnAt !== undefined && expectedReturnAt < now;
}

// Whole days until (positive) or since (negative) a date.
export function daysFromNow(timestamp: number, now = Date.now()): number {
  return Math.round((timestamp - now) / DAY_MS);
}
