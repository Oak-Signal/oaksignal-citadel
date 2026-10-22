# Development guide

## Requirements

- Node.js 20.9 or newer (22 LTS recommended) and npm 10 or newer
- Git

## Install

```powershell
npm install
```

`npm install` also installs the Husky pre-commit hook.

## Commands

| Command                | Purpose                                             |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Start the dev server at http://localhost:3000       |
| `npm run build`        | Production build                                    |
| `npm run start`        | Serve the production build                          |
| `npm run lint`         | ESLint (includes accessibility rules)               |
| `npm run typecheck`    | TypeScript check (`tsc --noEmit`, strict)           |
| `npm run format`       | Format with Prettier                                |
| `npm run format:check` | Verify formatting                                   |
| `npm run test`         | Unit tests (placeholder until the first tests land) |
| `npm run test:e2e`     | End-to-end tests (placeholder until Playwright)     |
| `npm run scan-secrets` | Scan staged files for secrets (`-- --all` for all)  |

## Build verification

Before opening a pull request, run:

```powershell
npm run format:check; npm run lint; npm run typecheck; npm run build
```

All four must pass.

## Environment variables

Copy `.env.example` to `.env.local` and fill in values locally. Never commit `.env.local` or any real
secret. Only variable names belong in `.env.example`.

## Secret scanning policy

A pre-commit hook runs `scripts/scan-secrets.mjs` on staged files and blocks the commit if it finds
likely keys, tokens, or private keys. Do not bypass it (no `--no-verify`). If a secret is committed
by mistake, rotate it immediately.

## Workflow

Work on a feature branch and open a pull request into `main`. Pull requests need one approval and
passing checks.
