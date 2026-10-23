<div align="center">

# ⚓ CITADEL

### Centralized Inventory Tracking, Asset Distribution, Equipment & Logistics

_The CITADEL Inventory Management System (CIMS), built by [OakSignal](https://github.com/Oak-Signal)_

[![CI](https://github.com/Oak-Signal/oaksignal-citadel/actions/workflows/ci.yml/badge.svg)](https://github.com/Oak-Signal/oaksignal-citadel/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-in%20development-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

</div>

---

## 🎯 Overview

**CITADEL** is OakSignal's centralized inventory management platform for cadet units. It gives a
unit complete visibility and control over its equipment, assets and logistics: tracking inventory,
managing who holds what, monitoring stock levels, and keeping accurate records across the whole
life of an asset.

Each unit's data is isolated from every other unit, and every action a person can take is
controlled by the role they hold in their unit.

> **Project status:** early development. The access-control foundation is complete and deployable;
> the inventory features listed under [Roadmap](#-roadmap) are being built story by story.

## ✨ Features

| Area                          | What it gives a unit                                                                 | Status     |
| ----------------------------- | ------------------------------------------------------------------------------------ | ---------- |
| **Secure access**             | Sign-in, unit-scoped roles and permissions, invitations, separate portals per role   | ✅ Built   |
| **Unit onboarding**           | Platform-managed unit provisioning, first-administrator verification, support grants | ✅ Built   |
| **Audit foundation**          | Append-only audit log written in the same transaction as every change                | ✅ Built   |
| **Inventory catalogue**       | Serialized assets (radios, laptops) and bulk or consumable stock with thresholds     | 🔜 Planned |
| **Issuance and returns**      | Recorded issue and return transactions with condition and responsible staff          | 🔜 Planned |
| **Cadet self-service**        | Cadets view what they hold and request equipment                                     | 🔜 Planned |
| **Audit trail views**         | Searchable accountability history                                                    | 🔜 Planned |
| **Dashboards and reports**    | Stock levels, overdue items, low-stock notifications, exports                        | 🔜 Planned |
| **Locations and stocktaking** | Multiple storage locations, maintenance, stocktakes                                  | 🔜 Planned |

### Two portals, one set of rules

- **Self-Service portal** (`/self-service`): for cadets. Their own data only, no operator controls.
- **Operator portal** (`/operator`): for staff. Navigation and actions are filtered by individual
  permissions, so a Supply Cadet can issue equipment without being able to manage roles or settings.
- **Platform area** (`/platform`): for OakSignal platform administrators. They can provision units,
  but see no unit data unless a time-limited, verified support grant is issued.

### Roles

Unit Administrator, Senior Cadet / Instructor, Junior Cadet, Supply Cadet, Civilian Staff, Officer
Staff and Logistics Officer. Administrators can adjust role permissions within platform limits. See
[Roles and permissions](docs/roles-and-permissions.md).

## 🧱 Architecture

```text
Browser ──► Next.js (App Router, React 19) ──► Clerk (authentication)
                │                                   │ verified identity
                └────────────► Convex (database, server functions, real-time)
                                  ├─ authorization on every function (fail closed)
                                  ├─ unit isolation via per-unit indexes
                                  └─ append-only audit log
```

**Key design points**

- **Fail-closed authorization.** Every public Convex function checks the signed-in identity, an
  active membership and a specific permission. A test fails the build if one does not.
- **Unit isolation.** Unit-scoped data is only read through unit-keyed indexes after a permission
  check. Supplying another unit's ID returns nothing.
- **Audit by construction.** Changes are written to an append-only log in the same transaction.
  There is no update or delete path.
- **The UI shows, the server enforces.** Portal routing hides what a person cannot use, and the
  backend re-checks every action regardless.

More detail: [Architecture](docs/architecture.md) · [Audit and integrity](docs/audit-and-integrity.md)

## 🛠️ Tech Stack

| Layer          | Technology                                                                      |
| -------------- | ------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router), React 19, TypeScript (strict)                          |
| UI             | Tailwind CSS v4, shadcn/ui on Base UI, Lucide icons                             |
| Backend        | Convex (database, server functions, real-time subscriptions)                    |
| Authentication | Clerk                                                                           |
| Validation     | Zod (shared with Convex validators)                                             |
| Testing        | Vitest, Testing Library, `convex-test`, Playwright, axe-core                    |
| Quality        | ESLint, Prettier, Husky pre-commit secret scan                                  |
| Delivery       | GitHub Actions CI, Vercel, Dependabot security updates                          |
| Process        | [GitHub Spec Kit](https://github.com/github/spec-kit) (spec-driven development) |

## 🚀 Getting Started

### Prerequisites

- Node.js **20.9 or later** and npm
- A [Clerk](https://clerk.com) application (development instance is fine)
- A [Convex](https://convex.dev) account

### Setup

```bash
git clone https://github.com/Oak-Signal/oaksignal-citadel.git
cd oaksignal-citadel
npm install
cp .env.example .env.local   # then fill in the values below
```

| Variable                            | Where it comes from                                |
| ----------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API keys                         |
| `CLERK_SECRET_KEY`                  | Clerk dashboard → API keys (also set it in Convex) |
| `CLERK_JWT_ISSUER_DOMAIN`           | Clerk Frontend API URL (also set it in Convex)     |
| `NEXT_PUBLIC_CONVEX_URL`            | Printed by `npx convex dev`                        |
| `CONVEX_DEPLOYMENT`                 | Written by `npx convex dev`                        |

In the **Convex dashboard** (Settings → Environment Variables), set `CLERK_JWT_ISSUER_DOMAIN` and
`CLERK_SECRET_KEY`. In Clerk, enable the Convex integration and add `email` and `name` to the
session token claims.

### Run locally

```bash
npx convex dev   # terminal 1: syncs backend functions to your dev deployment
npm run dev      # terminal 2: starts the app at http://localhost:3000
```

### Create your first unit

Platform administration is never set by the app. After signing in once, open the Convex dashboard,
go to **Data → `users`** and set `isPlatformAdmin` to `true` on your row. Then use
**Platform → Provision a unit**. Full walkthrough: [Onboarding](docs/onboarding.md).

## 🧪 Quality and Testing

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm test`             | Backend and component tests (Vitest)           |
| `npm run test:e2e`     | Playwright flows with axe accessibility checks |
| `npm run lint`         | ESLint                                         |
| `npm run typecheck`    | TypeScript, no emit                            |
| `npm run format`       | Prettier (`format:check` in CI)                |
| `npm run audit`        | Dependency vulnerability check                 |
| `npm run scan-secrets` | Secret scan (also runs on every commit)        |
| `npm run build`        | Production build                               |

CI runs install, lint, typecheck, format check, tests, build, audit and the secret scan on every
push and pull request. Strategy and troubleshooting: [Testing](docs/testing.md).

## 🗺️ Roadmap

Delivery follows prioritized user stories, each independently testable and deployable.

- [x] **Foundations**: backend, authentication, authorization, audit, design system, CI
- [x] **US1** Secure access with unit-scoped roles and permissions _(P1)_
- [ ] **US2** Inventory catalogue for serialized assets and bulk stock _(P1)_
- [ ] **US3** Equipment issuance and returns _(P1)_
- [ ] **US4** Cadet self-service portal and equipment requests _(P2)_
- [ ] **US5** Audit trail and accountability _(P2)_
- [ ] **US6** Dashboards, reports and notifications _(P3)_
- [ ] **US7** Storage locations, maintenance and stocktaking _(P3)_

## 📁 Project Structure

```text
app/           Next.js routes: /operator, /self-service, /platform, onboarding pages
components/    Shared UI (shell, portal guards, tables, dialogs) and shadcn/ui primitives
convex/        Schema, queries, mutations and the authorization, audit and validation core
lib/           Shared types, validation, portal routing rules and utilities
tests/         convex/ (backend), components/ (UI), e2e/ (Playwright)
docs/          Architecture, conventions, roles, onboarding, testing, deployment
specs/         Feature specifications, plan and tasks (Spec Kit)
```

## 📚 Documentation

[Architecture](docs/architecture.md) · [Conventions](docs/conventions.md) ·
[Roles and permissions](docs/roles-and-permissions.md) · [Onboarding](docs/onboarding.md) ·
[Audit and integrity](docs/audit-and-integrity.md) · [Design system](docs/design-system.md) ·
[Testing](docs/testing.md) · [Deployment](docs/deployment.md) · [Environments](docs/environments.md) ·
[Development](docs/development.md)

## ♿ Accessibility

CITADEL targets WCAG-compliant, keyboard-navigable, screen-reader-friendly interfaces that work on
desktop, tablet and phone. Accessibility is checked automatically with axe in the end-to-end suite.

## 🤝 Contributing

Contributions are welcome from developers who share OakSignal's commitment to quality tools for
youth organizations.

1. Branch from `main`; never push directly to it.
2. Follow the [conventions](docs/conventions.md) and write tests first for new behaviour.
3. Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before opening a PR.
4. Write clear commit messages and update the documentation your change affects.
5. Open a pull request into `main` using the template. It needs a passing CI run and one approving review.
6. Be respectful and constructive in discussions.

Never commit secrets. A pre-commit hook and CI both scan for them.

## 🔒 Security

Please do not report vulnerabilities in public issues. Contact the maintainers through the
[OakSignal organization](https://github.com/Oak-Signal).

## 📄 License

Released under the **MIT License**. See [LICENSE](LICENSE).

## 📬 About OakSignal

OakSignal builds reliable systems for cadet organizations, guided by four values:
**Clarity**, **Accessibility**, **Reliability** and **Maintainability**.

- 🌐 [OakSignal Landing](https://oak-signal.github.io/oaksignal-landing/)
- 💼 [@Oak-Signal](https://github.com/Oak-Signal)
- 🛠️ Related projects: [SignalsMaster](https://github.com/Oak-Signal/SignalsMaster)

---

<div align="center">

**Built with ❤️ for the Cadet Program**

_Developing the tools that support the next generation of leaders_

</div>
