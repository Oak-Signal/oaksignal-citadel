import type { Metadata } from "next";
import {
  ArrowRightIcon,
  Building2Icon,
  LifeBuoyIcon,
  MailIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { MailLink } from "@/components/site/MailLink";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { contact } from "@/lib/site-content";
import { pageMetadata } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Contact OakSignal to get your cadet unit started on CITADEL, ask for support, or report a security concern privately.",
  path: "/contact",
});

// One email address for everything (FR-015). Each topic offers a pre-addressed email with a
// subject line so enquiries arrive sorted; the address itself is always shown as plain text.
const TOPICS = [
  {
    id: "onboarding",
    icon: Building2Icon,
    subject: "CITADEL unit onboarding",
    action: "Email us about onboarding",
    ...contact.onboarding,
  },
  {
    id: "support",
    icon: LifeBuoyIcon,
    subject: "CITADEL support",
    action: "Email us for support",
    ...contact.support,
  },
  {
    id: "security",
    icon: ShieldAlertIcon,
    subject: "CITADEL security report",
    action: "Report privately by email",
    ...contact.security,
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <section aria-labelledby="contact-heading" className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        >
          <div className="absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="absolute top-1/4 left-[-15%] size-[26rem] rounded-full bg-signal/10 blur-3xl" />
        </div>

        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-16 pb-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:pt-24 lg:pb-16">
          <div className="flex flex-col items-start gap-4">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Get in touch
            </p>
            <h1
              id="contact-heading"
              className="text-4xl font-bold tracking-tight text-balance sm:text-5xl"
            >
              Contact
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              One address reaches OakSignal for unit onboarding, support, and security reports.
              Choose the topic below that fits your message.
            </p>
          </div>

          <Card className="shadow-xl shadow-primary/10">
            <CardContent className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
              >
                <MailIcon className="size-6" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-muted-foreground">Email OakSignal</p>
                <MailLink email={contact.email} className="text-lg" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {TOPICS.map(({ id, icon: Icon, title, body, subject, action }) => {
            const security = id === "security";
            return (
              <section key={id} aria-labelledby={`${id}-heading`} className="flex">
                <Card className={cn("w-full", security && "border-warning/30")}>
                  <CardHeader className="gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg",
                        security ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <CardTitle>
                      <h2 id={`${id}-heading`} className="text-lg font-semibold">
                        {title}
                      </h2>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </CardContent>
                  <CardFooter>
                    <a
                      href={`mailto:${contact.email}?subject=${encodeURIComponent(subject)}`}
                      className={cn(
                        buttonVariants({ variant: security ? "outline" : "default" }),
                        "h-10 w-full px-4",
                      )}
                    >
                      {action}
                      <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                    </a>
                  </CardFooter>
                </Card>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
