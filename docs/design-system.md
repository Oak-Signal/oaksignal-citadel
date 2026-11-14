# Design system

- **Brand.** CITADEL wordmark and the castle mark in [`public/citadel-logo.svg`](../public/citadel-logo.svg). Theme: "Fleet Command" - light gray-blue canvas, navy-tinted sidebar with a navy active pill, deep-blue primary, steel-teal (`signal`) accents, oak green (`success`). `destructive` is a deeper red used only for destructive actions.
- **Typography.** Inter (sans) for the interface, Geist Mono for codes and tags. Loaded in `app/(app)/layout.tsx` and `app/(site)/layout.tsx` and mapped to `--font-sans` and `--font-mono` in `app/globals.css`.
- **Tokens.** Colour, radius, and sidebar tokens are CSS variables in `app/globals.css` (light theme only), including `success`, `warning` and `info` status tokens (see `Badge` variants), exposed to Tailwind through `@theme inline`. Use tokens (`bg-primary`, `text-muted-foreground`), not raw colours.
- **Contrast.** Text must meet WCAG AA (4.5:1). Avoid `text-destructive` or muted text on tinted backgrounds; the axe test enforces this.
- **Components.** Shared pieces in `components/shared/`: `AppShell`, `AccountMenu`, `PageHeader`, `DataTable`, `FormField`, `ConfirmDialog`, `PermissionGate`, `Loading`, `EmptyState`, `ErrorState`, `ErrorBoundary`.
- **Responsive.** Sidebar from `md` up, a drawer with a menu button below it; no horizontal overflow at 375px.
- **Preview.** `/design-preview` (development only) renders the shell and components for review and for the accessibility tests.
