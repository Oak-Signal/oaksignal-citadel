"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { NavItem, Portal } from "@/lib/types";
import { useCan } from "@/components/shared/PermissionGate";

const PORTAL_LABELS: Record<Portal, string> = {
  "self-service": "Self-service",
  operator: "Operator",
  platform: "Platform",
};

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // The most specific matching link is the current one, so "/operator" is not highlighted on
  // "/operator/members".
  const current = items
    .filter((item) => matches(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item === current;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className="block rounded-lg border-l-4 border-transparent px-3 py-2 text-sm font-medium text-sidebar-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:border-gold aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
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
  const visibleItems = navItems.filter((item) => !item.permission || can(item.permission));
  const portalLabel = PORTAL_LABELS[portal];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>

      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 md:flex">
        <div>
          <p className="text-lg font-bold tracking-wide text-primary">CITADEL</p>
          <p className="text-xs text-muted-foreground">{portalLabel} portal</p>
        </div>
        <nav aria-label={`${portalLabel} navigation`}>
          <NavLinks items={visibleItems} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b-2 border-b-gold bg-card px-4 py-3">
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
              <SheetTitle>CITADEL {portalLabel}</SheetTitle>
            </SheetHeader>
            <nav aria-label={`${portalLabel} navigation`} className="px-4">
              <NavLinks items={visibleItems} onNavigate={() => setDrawerOpen(false)} />
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
