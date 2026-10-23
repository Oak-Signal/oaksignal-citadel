import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";
import { toUiError } from "@/lib/errors";
import { addDays, daysFromNow, isOverdue } from "@/lib/format";
import { can, roleLabel } from "@/lib/permissions";
import {
  assetTagSchema,
  emailSchema,
  fieldErrors,
  positiveQuantitySchema,
  unitSettingsSchema,
} from "@/lib/validation";

describe("csv", () => {
  it("quotes cells with commas, quotes, and newlines", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell("-1+1")).toBe("'-1+1");
  });

  it("builds a CSV with headers and empty cells", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          [1, null],
          ["x", undefined],
        ],
      ),
    ).toBe("a,b\r\n1,\r\nx,");
  });
});

describe("format", () => {
  it("detects overdue items", () => {
    expect(isOverdue(100, 200)).toBe(true);
    expect(isOverdue(300, 200)).toBe(false);
    expect(isOverdue(undefined, 200)).toBe(false);
  });

  it("adds and counts days", () => {
    const now = 1_000_000;
    expect(daysFromNow(addDays(now, 3), now)).toBe(3);
    expect(daysFromNow(addDays(now, -2), now)).toBe(-2);
  });
});

describe("errors", () => {
  it("surfaces structured Convex errors", () => {
    const error = new ConvexError({ code: "CONFLICT", message: "Asset tag already exists." });
    expect(toUiError(error)).toEqual({ code: "CONFLICT", message: "Asset tag already exists." });
  });

  it("hides unknown error details", () => {
    expect(toUiError(new Error("secret stack detail"))).toEqual({
      code: "UNKNOWN",
      message: "Something went wrong. Please try again.",
    });
  });
});

describe("permissions", () => {
  it("shows controls only for held permissions", () => {
    const grants = { roles: ["supply_cadet"], extraPermissions: [], revokedPermissions: [] };
    expect(can(grants, "issuance.perform")).toBe(true);
    expect(can(grants, "audit.view")).toBe(false);
    expect(can(undefined, "issuance.perform")).toBe(false);
  });

  it("labels known roles", () => {
    expect(roleLabel("unit_admin")).toBe("Unit Administrator");
    expect(roleLabel("custom")).toBe("custom");
  });
});

describe("validation", () => {
  it("trims and requires an asset tag", () => {
    expect(assetTagSchema.parse("  A-1  ")).toBe("A-1");
    expect(assetTagSchema.safeParse("   ").success).toBe(false);
  });

  it("validates emails", () => {
    expect(emailSchema.parse(" Cadet@Example.com ")).toBe("cadet@example.com");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("requires positive whole quantities", () => {
    expect(positiveQuantitySchema.safeParse(2).success).toBe(true);
    expect(positiveQuantitySchema.safeParse(0).success).toBe(false);
    expect(positiveQuantitySchema.safeParse(1.5).success).toBe(false);
  });

  it("reports errors per field", () => {
    const result = unitSettingsSchema.safeParse({
      defaultReturnDays: 0,
      retentionYears: 7,
      lowStockNotifications: true,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(Object.keys(fieldErrors(result.error))).toEqual(["defaultReturnDays"]);
  });
});
