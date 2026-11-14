import Image from "next/image";
import Link from "next/link";
import { GlobeIcon, HeartIcon, MailIcon, TriangleAlertIcon } from "lucide-react";
import { ExternalLink } from "@/components/site/ExternalLink";
import { GitHubMark } from "@/components/site/GitHubMark";
import { MailLink } from "@/components/site/MailLink";
import { contact, disclaimer, footerLinkGroups, site, type NavLink } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const linkClass =
  "rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/50";

const EXTERNAL_ICONS: Record<string, typeof GlobeIcon | typeof GitHubMark> = {
  "https://github.com/Oak-Signal": GitHubMark,
  "https://oak-signal.github.io/oaksignal-landing/": GlobeIcon,
};

function FooterLink({ link }: { link: NavLink }) {
  if (link.external) {
    const Icon = EXTERNAL_ICONS[link.href];
    return (
      <ExternalLink href={link.href} className={cn(linkClass, "gap-2")}>
        {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
        {link.label}
      </ExternalLink>
    );
  }
  return (
    <Link
      href={link.href}
      // Sign-in lives in the other root layout; prefetch is off so no sign-in code loads here.
      prefetch={link.href.startsWith("/sign-in") ? false : undefined}
      className={linkClass}
    >
      {link.label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-14 sm:px-6">
        <aside
          aria-labelledby="disclaimer-heading"
          className="flex gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4 sm:p-5"
        >
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="flex flex-col gap-1">
            <h2 id="disclaimer-heading" className="text-sm font-semibold text-foreground">
              {disclaimer.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{disclaimer.body}</p>
          </div>
        </aside>

        <div className="grid gap-10 lg:grid-cols-[1.3fr_3fr]">
          <div className="flex max-w-sm flex-col gap-4">
            <p className="flex items-center gap-2.5">
              <Image src="/citadel-logo.svg" alt="" width={32} height={32} />
              <span className="text-base font-bold tracking-[0.2em] text-foreground">
                {site.name}
              </span>
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {site.expansion}. Built by OakSignal and free for cadet units.
            </p>
          </div>

          <nav aria-label="Footer" className="grid gap-10 sm:grid-cols-[1fr_1fr_1.4fr]">
            {footerLinkGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-4">
                <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">
                  {group.title}
                </h2>
                <ul className="flex flex-col gap-3">
                  {group.title === "Connect" ? (
                    <li className="flex items-center gap-2">
                      <MailIcon
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <MailLink
                        email={contact.email}
                        className="text-sm font-normal text-muted-foreground hover:text-foreground"
                      />
                    </li>
                  ) : null}
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t pt-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p>© {site.name} by OakSignal. All rights reserved.</p>
            <p className="w-fit rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              {disclaimer.short}
            </p>
          </div>
          <p className="flex items-center gap-1.5">
            Built with
            <HeartIcon aria-hidden="true" className="size-4 fill-destructive text-destructive" />
            <span className="sr-only">love</span>
            for the Cadet Program
          </p>
        </div>
      </div>
    </footer>
  );
}
