# CITADEL (CIMS)

Oak Signal's CITADEL project, including the CIMS (CITADEL Inventory Management System).

## Status

Early setup. Specs and planning are managed with GitHub Spec Kit (see `.specify/` and `specs/`).

## Stack

Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, Clerk, Convex, Vercel.

## Prerequisites

- Node.js 20.9+ (22 LTS recommended) and npm
- Git

## Getting Started

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in values locally; never commit them
npm run dev
```

Open http://localhost:3000. See [docs/development.md](docs/development.md) for all commands.

## Contributing

Work on feature branches and open a pull request into `main`. Before pushing, run
`npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build`.
