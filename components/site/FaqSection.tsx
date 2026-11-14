"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { SectionHeading } from "@/components/site/SectionHeading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/lib/site-content";

// FR-013: plain-language answers. Several answers can be open at once, and each opens in place.
export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-20 sm:py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 sm:px-6">
        <SectionHeading
          id="faq-heading"
          eyebrow="Questions"
          title="Frequently asked questions"
          description="If your question is not answered here, contact OakSignal."
        />
        <Accordion multiple className="rounded-xl border bg-card px-5 shadow-xs sm:px-6">
          {faqs.map((entry) => (
            <AccordionItem key={entry.id} value={entry.id}>
              <AccordionTrigger className="py-4 text-base">{entry.question}</AccordionTrigger>
              <AccordionContent className="pb-4 text-base leading-relaxed text-muted-foreground">
                <p>{entry.answer}</p>
                {entry.link ? (
                  <p>
                    <Link
                      href={entry.link.href}
                      className="inline-flex items-center gap-1 font-medium text-primary"
                    >
                      {entry.link.label}
                      <ArrowRightIcon aria-hidden="true" className="size-4" />
                    </Link>
                  </p>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
