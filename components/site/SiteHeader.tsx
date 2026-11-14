"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { headerLinks, signInLink, site, type NavLink } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function NavList({
  links,
  onNavigate,
  vertical,
}: {
  links: NavLink[];
  onNavigate?: () => void;
  vertical?: boolean;
}) {
  return (
    <ul className={cn("flex", vertical ? "flex-col gap-1" : "items-center gap-1 lg:gap-2")}>
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "block rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none",
              vertical ? "px-3 py-2.5 text-base hover:bg-accent" : "px-3 py-2",
              focusRing,
            )}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Sign-in lives in the other root layout; prefetch is off so no sign-in code loads here.
function SignInLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      href={signInLink.href}
      prefetch={false}
      onClick={onClick}
      className={cn(buttonVariants(), "h-9 px-4", className)}
    >
      {signInLink.label}
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-card/85 supports-backdrop-filter:bg-card/70 supports-backdrop-filter:backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          aria-label="CITADEL home"
          className={cn("flex w-fit items-center gap-2.5 rounded-md", focusRing)}
        >
          <Image src="/citadel-logo.svg" alt="" width={32} height={32} priority />
          <span className="text-base font-bold tracking-[0.2em] text-foreground">{site.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <NavList links={headerLinks} />
        </nav>

        <div className="flex items-center justify-end gap-2">
          <SignInLink className="hidden md:inline-flex" />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <MenuIcon aria-hidden="true" />
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} className="gap-6 p-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2.5 font-bold tracking-[0.2em] text-foreground">
                  <Image src="/citadel-logo.svg" alt="" width={28} height={28} />
                  {site.name}
                </SheetTitle>
                <SheetClose
                  render={<Button variant="ghost" size="icon-sm" aria-label="Close menu" />}
                >
                  <XIcon aria-hidden="true" />
                </SheetClose>
              </div>
              <nav aria-label="Main">
                <NavList links={headerLinks} onNavigate={close} vertical />
              </nav>
              <SignInLink onClick={close} className="h-10 w-full" />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
