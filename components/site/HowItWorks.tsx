import { ClipboardListIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { howItWorksSteps, permissionsSummary, portals } from "@/lib/site-content";

const PORTAL_ICONS = { "Self-service": UserRoundIcon, Operator: ClipboardListIcon } as const;

// FR-011: the real onboarding model, then the two portals and role-based permissions.
export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="py-20 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 sm:px-6">
        <SectionHeading
          id="how-heading"
          eyebrow="Getting started"
          title="How it works"
          description="CITADEL is set up for each unit by the platform, then run by the unit itself."
        />

        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {howItWorksSteps.map((step) => (
            <li
              key={step.order}
              className="relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs"
            >
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
              >
                {step.order}
              </span>
              <h3 className="font-semibold text-foreground">
                <span className="sr-only">Step {step.order}: </span>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-6">
          <h3 className="text-center text-xl font-semibold tracking-tight">Two portals</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {portals.map((portal) => {
              const Icon = PORTAL_ICONS[portal.name];
              return (
                <Card key={portal.name} className="h-full">
                  <CardHeader className="flex flex-row items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <CardTitle>
                        <h4 className="text-base font-semibold">{portal.name} portal</h4>
                      </CardTitle>
                      <CardDescription className="leading-relaxed">
                        {portal.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
          <p className="mx-auto flex max-w-2xl items-center gap-2 text-center text-sm text-muted-foreground">
            <ShieldCheckIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
            {permissionsSummary}
          </p>
        </div>
      </div>
    </section>
  );
}
