# Conventions

- **TypeScript strict.** No `any` unless unavoidable (documented, e.g. audit before/after snapshots).
- **Naming.** Files: components `PascalCase.tsx`, everything else `camelCase.ts` or `kebab-case.ts`. Convex tables are camelCase plurals; indexes are `by_<field>_and_<field>`; error codes and permission keys are fixed strings from their catalogues.
- **Imports.** Use the `@/` alias for app code.
- **Backend.** One authorization call at the top of each unit-scoped function; no direct `auditLog` writes; no hard deletes of business records.
- **Client.** Validate forms with schemas from `lib/validation.ts`; show errors through `FormField`; never display raw server errors.
- **Accessibility.** Every control has a label, is keyboard operable, and has a visible focus state.
- **Formatting.** Prettier and ESLint are enforced by a pre-commit hook and CI. Run `npm run format`.
- **Commits.** Conventional style (`feat:`, `fix:`, `chore:`, `docs:`). Never commit secrets; `npm run scan-secrets` runs in the hook and CI.
