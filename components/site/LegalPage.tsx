import { Fragment, type ReactNode } from "react";
import { DraftNotice } from "@/components/site/DraftNotice";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export type LegalSection = { id: string; title: string; body: ReactNode };

// Readable defaults for legal copy (no typography plugin in this project).
const PROSE =
  "flex flex-col gap-3 text-[0.95rem] leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5";

// Shared layout for the Terms of Service and Privacy Policy drafts. The draft notice sits
// directly after the h1 so it is the first thing read (FR-016).
export function LegalPage({
  title,
  summary,
  updated,
  sections,
}: {
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-20 lg:pb-24">
      <header className="flex max-w-3xl flex-col gap-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Legal</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{title}</h1>
        <DraftNotice />
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{summary}</p>
        <p className="text-sm text-muted-foreground">
          Last updated: <time dateTime={updated}>{updated}</time>
        </p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[14rem_1fr] lg:items-start">
        <nav aria-label="On this page" className="lg:sticky lg:top-24">
          <p className="mb-3 text-xs font-semibold tracking-wider text-foreground uppercase">
            On this page
          </p>
          <ol className="flex flex-col gap-1 border-l text-sm">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px block border-l border-transparent py-1 pl-3 text-muted-foreground outline-none hover:border-primary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Card>
          <CardContent className="flex flex-col gap-8 py-2 sm:px-8">
            {sections.map((section, index) => (
              <Fragment key={section.id}>
                {index > 0 ? <Separator /> : null}
                <section id={section.id} aria-labelledby={`${section.id}-heading`}>
                  <h2
                    id={`${section.id}-heading`}
                    className="mb-3 text-xl font-semibold tracking-tight text-foreground"
                  >
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {section.title}
                  </h2>
                  <div className={PROSE}>{section.body}</div>
                </section>
              </Fragment>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
