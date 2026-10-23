import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const convexDir = path.resolve(__dirname, "../../convex");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "_generated") return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

const relative = (file: string) => path.relative(convexDir, file).replaceAll("\\", "/");

// Splits a module into its top-level `export const x = query|mutation|action(...)` blocks.
function exportedFunctions(source: string) {
  const blocks = source.split(/^(?=export const )/m);
  return blocks
    .map((block) => {
      const match = /^export const (\w+) = (query|mutation|action)\(/.exec(block);
      return match ? { name: match[1], kind: match[2], body: block } : null;
    })
    .filter((block): block is { name: string; kind: string; body: string } => block !== null);
}

const AUTH_CALL =
  /\b(requireUnitPermission|requireUnitMember|requirePlatformAdmin|requireUser|checkUnitPermission)\(/;

describe("authorization guard", () => {
  it("every exported public function calls an authorization helper (or is an allowed exception)", () => {
    // `users.me` deliberately returns null when signed out; `syncCurrentUser` uses requireIdentity.
    const allowed = new Set([
      "users.me",
      "users.syncCurrentUser",
      "users.syncFromClerk",
      "access.myAccess",
    ]);
    const missing: string[] = [];
    for (const file of sourceFiles(convexDir)) {
      const rel = relative(file);
      if (rel.startsWith("lib/") || rel === "schema.ts" || rel === "auth.config.ts") continue;
      for (const fn of exportedFunctions(fs.readFileSync(file, "utf8"))) {
        const id = `${rel.replace(/\.ts$/, "")}.${fn.name}`;
        if (allowed.has(id)) continue;
        if (!AUTH_CALL.test(fn.body)) missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });

  it("unit-scoped functions use an index named by_unit... rather than scanning", () => {
    for (const file of sourceFiles(convexDir)) {
      const rel = relative(file);
      if (rel.startsWith("lib/") || rel === "schema.ts") continue;
      for (const fn of exportedFunctions(fs.readFileSync(file, "utf8"))) {
        if (!/unitId:\s*v\.id\("units"\)/.test(fn.body)) continue;
        const queriesUnitTable =
          /\.query\("(auditLog|memberships|transactions|transactionLines|assignments|notifications|roleDefinitions)"\)/.test(
            fn.body,
          );
        if (queriesUnitTable) {
          expect(fn.body, `${rel}:${fn.name}`).toMatch(/withIndex\("by_(unit|\w*unit\w*)/);
        }
      }
    }
  });
});

describe("audit log integrity", () => {
  it("only appendAudit inserts into auditLog", () => {
    const writers = sourceFiles(convexDir)
      .map((file) => ({ rel: relative(file), source: fs.readFileSync(file, "utf8") }))
      .filter(({ source }) => /insert\(\s*"auditLog"/.test(source))
      .map(({ rel }) => rel);
    expect(writers).toEqual(["lib/audit.ts"]);
  });

  it("no module updates or deletes auditLog entries", () => {
    for (const file of sourceFiles(convexDir)) {
      const rel = relative(file);
      if (rel === "schema.ts") continue;
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes('"auditLog"')) continue;
      expect(source, rel).not.toMatch(/db\.(patch|replace|delete)\(/);
    }
  });

  it("convex/audit.ts exports only read queries", () => {
    const source = fs.readFileSync(path.join(convexDir, "audit.ts"), "utf8");
    const kinds = exportedFunctions(source).map((fn) => fn.kind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(["query"]));
  });
});
