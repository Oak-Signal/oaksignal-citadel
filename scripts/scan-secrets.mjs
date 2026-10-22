// Blocks commits that contain likely secrets. Scans staged files (or all tracked files with --all).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  ["Private key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["Clerk secret key", /\bsk_(?:test|live)_[A-Za-z0-9]{16,}\b/],
  ["Stripe/secret-style key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  [
    "Generic secret assignment",
    /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*["'][A-Za-z0-9_\-/+=]{20,}["']/i,
  ],
];

const SKIP =
  /(^|\/)(package-lock\.json|scripts\/scan-secrets\.mjs)$|\.(png|jpe?g|gif|ico|woff2?|pdf)$/i;

const all = process.argv.includes("--all");
const args = all ? ["ls-files"] : ["diff", "--cached", "--name-only", "--diff-filter=ACMR"];
const files = execFileSync("git", args, { encoding: "utf8" })
  .split("\n")
  .map((f) => f.trim())
  .filter((f) => f && !SKIP.test(f));

let findings = 0;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    for (const [name, re] of PATTERNS) {
      if (re.test(line)) {
        console.error(`${file}:${i + 1}: possible ${name}`);
        findings++;
      }
    }
  });
}

if (findings > 0) {
  console.error(`\nSecret scan failed: ${findings} finding(s). Remove the secret and rotate it.`);
  process.exit(1);
}
process.stdout.write(`Secret scan passed (${files.length} file(s) checked).\n`);
