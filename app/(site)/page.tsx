import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { FaqSection } from "@/components/site/FaqSection";
import { FeatureGrid } from "@/components/site/FeatureGrid";
import { Hero } from "@/components/site/Hero";
import { HowItWorks } from "@/components/site/HowItWorks";
import { TrustSection } from "@/components/site/TrustSection";
import { buttonVariants } from "@/components/ui/button";
import { site } from "@/lib/site-content";
import { pageMetadata } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: `${site.name}: ${site.valueStatement}`,
  description: site.description,
  path: "/",
  absoluteTitle: true,
});

function ClosingCallToAction() {
  return (
    <section aria-labelledby="closing-heading" className="px-4 py-20 sm:px-6">
      <div className="relative isolate mx-auto flex w-full max-w-6xl flex-col items-start gap-6 overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground shadow-xl shadow-primary/20 sm:px-12 md:flex-row md:items-center md:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-signal/30 blur-3xl"
        />
        <div className="flex max-w-xl flex-col gap-3">
          <h2 id="closing-heading" className="text-3xl font-bold tracking-tight text-balance">
            Ready to bring CITADEL to your unit?
          </h2>
          <p className="text-primary-foreground/85">
            Units are set up by the platform on request, and CITADEL is free for cadet units.
            Members join by invitation.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "h-11 bg-primary-foreground px-5 text-sm text-primary hover:bg-primary-foreground/90",
            )}
          >
            Get your unit started
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
          <Link
            href="/sign-in"
            prefetch={false}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 border-primary-foreground/40 bg-transparent px-5 text-sm text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
            )}
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

// Static by design: nothing here reads cookies, headers, or search params (FR-029).
export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <TrustSection />
      <FaqSection />
      <ClosingCallToAction />
    </>
  );
}
