import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// FR-004 / SC-007: the public site must not be able to read unit data or call authorized
// server functions. It may not import Convex, Clerk, or the app's access providers at all.

const root = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const publicFiles = [
  ...sourceFiles(path.join(root, "app", "(site)")),
  ...sourceFiles(path.join(root, "components", "site")),
  ...fs
    .readdirSync(path.join(root, "lib"))
    .filter((name) => /^site-.*\.ts$/.test(name))
    .map((name) => path.join(root, "lib", name)),
];

const relative = (file: string) => path.relative(root, file).replaceAll("\\", "/");

describe("public site isolation", () => {
  it("finds the public site sources", () => {
    const files = publicFiles.map(relative);
    expect(files).toContain("app/(site)/layout.tsx");
    expect(files).toContain("app/(site)/page.tsx");
    expect(files).toContain("lib/site-content.ts");
  });

  it("imports no Convex or Clerk modules", () => {
    const offenders = publicFiles
      .filter((file) =>
        /from\s+["'](convex\/|@\/convex\/|@clerk\/)/.test(fs.readFileSync(file, "utf8")),
      )
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it("does not use the app's access or data providers", () => {
    const offenders = publicFiles
      .filter((file) =>
        /\b(AccessProvider|ConvexClientProvider|UserSync)\b/.test(fs.readFileSync(file, "utf8")),
      )
      .map(relative);
    expect(offenders).toEqual([]);
  });

  it("mounts no Clerk or Convex provider in the public root layout", () => {
    const layout = fs.readFileSync(path.join(root, "app", "(site)", "layout.tsx"), "utf8");
    expect(layout).not.toMatch(/ClerkProvider|ConvexProvider/);
  });
});
