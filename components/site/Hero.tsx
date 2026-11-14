import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  PackageIcon,
  RadioIcon,
  CompassIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { heroHighlights, site } from "@/lib/site-content";
import { cn } from "@/lib/utils";

// Decorative sketch of an issue record in the operator portal. It shows the kind of record
// CITADEL keeps, not real data, so it is hidden from assistive technology and captioned.
const PREVIEW_ROWS = [
  { icon: RadioIcon, name: "Handheld radio", detail: "Asset RAD-014", state: "Issued" },
  { icon: PackageIcon, name: "Field jacket × 2", detail: "Bulk stock", state: "Issued" },
  { icon: CompassIcon, name: "Compass", detail: "Asset NAV-003", state: "Returned" },
] as const;

function ProductPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10 ring-1 ring-primary/5"
      >
        <div className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-3">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">
            Operator portal · Issuance
          </span>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Issue record</p>
              <p className="text-xs text-muted-foreground">Due back in 14 days</p>
            </div>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
              Saved
            </span>
          </div>
          <ul className="flex flex-col divide-y rounded-xl border">
            {PREVIEW_ROWS.map(({ icon: Icon, name, detail, state }) => (
              <li key={name} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{name}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{detail}</span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    state === "Issued" ? "bg-info/10 text-info" : "bg-success/10 text-success",
                  )}
                >
                  {state}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-success" />
            Recorded in the unit&apos;s audit history
          </p>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Illustration of an issue record in the operator portal
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden" aria-labelledby="hero-heading">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <div className="absolute -top-40 right-[-10%] size-[42rem] rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute top-1/3 left-[-15%] size-[30rem] rounded-full bg-signal/10 blur-3xl" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-24 lg:pb-28">
        <div className="flex flex-col items-start gap-6">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-signal" />
            {site.tagline}
          </p>

          <h1 id="hero-heading" className="flex flex-col gap-3">
            <span className="text-sm font-bold tracking-[0.3em] text-primary">{site.name}</span>
            <span className="text-4xl leading-[1.05] font-bold tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
              {site.valueStatement}
            </span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            {site.summary}
          </p>

          <div className="flex flex-wrap gap-3">
            {/* Sign-in lives in the other root layout; prefetch is off so no sign-in code loads here. */}
            <Link
              href="/sign-in"
              prefetch={false}
              className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-sm")}
            >
              Sign in
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 bg-card px-5 text-sm",
              )}
            >
              Get your unit started
            </Link>
          </div>

          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {heroHighlights.map((highlight, index) => (
              <li key={highlight} className="flex items-center gap-3">
                {index > 0 ? (
                  <span aria-hidden="true" className="size-1 rounded-full bg-muted-foreground/40" />
                ) : null}
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}
