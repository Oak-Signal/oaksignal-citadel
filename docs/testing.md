# Testing

## Strategy

| Layer                 | Tool                                   | Location                       |
| --------------------- | -------------------------------------- | ------------------------------ |
| Backend (Convex)      | Vitest + `convex-test` (edge-runtime)  | `tests/convex/`                |
| Components, utilities | Vitest + React Testing Library (jsdom) | `tests/components/`            |
| End to end            | Playwright (desktop, tablet, phone)    | `tests/e2e/`                   |
| Accessibility         | `@axe-core/playwright` (WCAG 2 A/AA)   | `tests/e2e/a11y-shell.spec.ts` |

Security-critical behavior (authorization matrix, unit isolation, audit integrity) must have backend tests. `tests/convex/guard.test.ts` fails when an exported function lacks an authorization call or when `auditLog` is written outside `appendAudit()`.

## Running

```powershell
npm test                  # all Vitest projects
npx vitest run --project convex
npx vitest run --project components
npm run test:e2e          # starts `npm run dev` if nothing is on port 3000
npm run audit             # production dependency audit
npm run scan-secrets -- --all
```

## Troubleshooting

- **First e2e run:** `npx playwright install chromium`.
- **E2E needs the dev server:** it reuses one on port 3000 or starts its own. Set `E2E_BASE_URL` to target another URL.
- **Vitest 5 needs Node 22+ and `@types/node` 22+.**
- **`Cannot find native binding` (rolldown) on Windows:** run `npm i --no-save @rolldown/binding-win32-x64-msvc`.
- **convex-test cannot find modules:** check the `import.meta.glob` in `tests/convex/setup.ts` still includes `convex/_generated`.
- **`/design-preview`** is dev-only; the e2e shell tests rely on it.
