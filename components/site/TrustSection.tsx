import { AccessibilityIcon, KeyRoundIcon, LockKeyholeIcon, ScrollTextIcon } from "lucide-react";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trustPrinciples, values } from "@/lib/site-content";

const PRINCIPLE_ICONS = [LockKeyholeIcon, KeyRoundIcon, ScrollTextIcon, AccessibilityIcon];

// FR-012: only protections the product enforces today, plus OakSignal's four values.
export function TrustSection() {
  return (
    <section id="trust" aria-labelledby="trust-heading" className="bg-card py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:items-start">
        <div className="flex flex-col gap-8 lg:sticky lg:top-24">
          <SectionHeading
            id="trust-heading"
            eyebrow="Trust and principles"
            title="Built for trust"
            description="Accountability is the reason CITADEL exists, so these protections are enforced by the system, not left to good intentions."
            align="start"
          />
          <div className="flex flex-col gap-3">
            <p id="values-label" className="text-sm font-semibold text-foreground">
              Our values
            </p>
            <ul aria-labelledby="values-label" className="flex flex-wrap gap-2">
              {values.map((value) => (
                <li
                  key={value}
                  className="rounded-full border bg-background px-3 py-1 text-sm font-medium text-foreground"
                >
                  {value}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {trustPrinciples.map((principle, index) => {
            const Icon = PRINCIPLE_ICONS[index];
            return (
              <li key={principle.title} className="flex">
                <Card className="w-full">
                  <CardHeader className="gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    >
                      <Icon className="size-5" />
                    </span>
                    <CardTitle>
                      <h3 className="text-base font-semibold">{principle.title}</h3>
                    </CardTitle>
                    <CardDescription className="leading-relaxed">
                      {principle.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
