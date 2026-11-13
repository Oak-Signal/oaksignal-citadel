"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NavItem, Portal } from "@/lib/types";
import { useCan } from "@/components/shared/PermissionGate";
import { groupNavItems, visibleNavItems, type NavSection } from "@/components/shared/nav-config";

const PORTAL_LABELS: Record<Portal, string> = {
  "self-service": "Self-service",
  operator: "Operator",
  platform: "Platform",
};

const TAGLINE = [
  ["C", "entralized"],
  ["I", "nventory"],
  ["T", "racking,"],
  ["A", "sset"],
  ["D", "istribution,"],
  ["E", "quipment &"],
  ["L", "ogistics"],
] as const;

function BrandTagline() {
  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      {TAGLINE.map(([initial, rest], i) => (
        <span key={initial}>
          <span className="font-semibold text-primary">{initial}</span>
          {rest}
          {i < TAGLINE.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

function NavLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const baseId = useId();
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const all = sections.flatMap((section) =>
    section.items.flatMap((item) => [item, ...(item.children ?? [])]),
  );
  // The most specific matching link is the current one, so "/operator" is not highlighted on
  // "/operator/members".
  const current = all
    .filter((item) => matches(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  function renderLink(item: NavItem, nested = false) {
    const active = item === current;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`block rounded-lg border-l-4 border-transparent py-2 pr-3 text-sm font-medium text-sidebar-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/60 aria-[current=page]:border-signal aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground ${nested ? "pl-7" : "pl-3"}`}
        >
          {item.label}
        </Link>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section, index) => {
        const headingId = `${baseId}-${index}`;
        return (
          <div key={section.title ?? "top"}>
            {section.title ? (
              <p
                id={headingId}
                className="mb-1 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                {section.title}
              </p>
            ) : null}
            <ul
              className="flex flex-col gap-1"
              aria-labelledby={section.title ? headingId : undefined}
            >
              {section.items.flatMap((item) => {
                const open =
                  item === current || (item.children ?? []).some((child) => child === current);
                return [
                  renderLink(item),
                  ...(open ? (item.children ?? []).map((child) => renderLink(child, true)) : []),
                ];
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Layout primitives shared by every portal: a skip link, a sidebar on wide screens, and a
// drawer menu on narrow ones. Content scrolls inside `main`; the page itself never scrolls
// sideways.
export function AppShell({
  portal,
  navItems,
  accountMenu,
  children,
}: {
  portal: Portal;
  navItems: NavItem[];
  accountMenu: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const can = useCan();
  const sections = groupNavItems(visibleNavItems(navItems, can));
  const portalLabel = PORTAL_LABELS[portal];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>

      <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="flex flex-col gap-1.5 border-b border-sidebar-border pb-4">
          <p className="text-lg font-bold tracking-[0.2em] text-primary">CITADEL</p>
          <BrandTagline />
          <p className="mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-primary/15 bg-primary/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-primary uppercase shadow-sm">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
            {portalLabel} portal
          </p>
        </div>
        <nav aria-label={`${portalLabel} navigation`}>
          <NavLinks sections={sections} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon aria-hidden="true" />
            </Button>
            <span className="font-semibold md:hidden">CITADEL</span>
          </div>
          {accountMenu}
        </header>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle className="text-primary">CITADEL {portalLabel}</SheetTitle>
              <BrandTagline />
            </SheetHeader>
            <nav aria-label={`${portalLabel} navigation`} className="px-4">
              <NavLinks sections={sections} onNavigate={() => setDrawerOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
