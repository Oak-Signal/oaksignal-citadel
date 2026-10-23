## Summary

<!-- What changed and why. Link the task (T###) and Linear issue. -->

## Constitution compliance

- [ ] Unit isolation: every unit-scoped function calls `requireUnitPermission` and uses `by_unit...` indexes
- [ ] Authorization is enforced on the server, not only hidden in the UI
- [ ] Data-changing mutations write an audit entry through `appendAudit()`
- [ ] No secrets, personal data, or sensitive values in code, logs, or fixtures
- [ ] Inputs validated on the server (Convex validators) and in the client (shared Zod schemas)
- [ ] Accessible: labels, keyboard support, visible focus, and contrast checked
- [ ] Works on desktop, tablet, and phone widths (no horizontal overflow)
- [ ] Tests added or updated and passing; docs updated

## Checks

- [ ] `npm run lint`, `npm run typecheck`, `npm run format:check`
- [ ] `npm test` (and `npm run test:e2e` for UI changes)
