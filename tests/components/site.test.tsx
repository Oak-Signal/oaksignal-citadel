import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/(site)/page";
import ContactPage from "@/app/(site)/contact/page";
import PrivacyPage from "@/app/(site)/privacy/page";
import TermsPage from "@/app/(site)/terms/page";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import {
  FEATURE_STATUS_LABELS,
  faqs,
  features,
  howItWorksSteps,
  trustPrinciples,
} from "@/lib/site-content";

// jsdom has no image optimizer; render next/image as a plain element with the same alt text.
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span role={alt ? "img" : undefined} aria-label={alt || undefined} data-src={src} />
  ),
}));

const EMAIL = "contact.oaksignal@gmail.com";

describe("home page (US1)", () => {
  it("has exactly one h1 that names CITADEL", () => {
    render(<HomePage />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("CITADEL");
  });

  it("offers Sign in and Get your unit started, and never self-registration", () => {
    render(<HomePage />);
    for (const link of screen.getAllByRole("link", { name: /^Sign in/ })) {
      expect(link).toHaveAttribute("href", "/sign-in");
    }
    const getStarted = screen.getAllByRole("link", { name: /^Get your unit started/ });
    expect(getStarted.length).toBeGreaterThan(0);
    for (const link of getStarted) expect(link).toHaveAttribute("href", "/contact");
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => href.includes("/sign-up"))).toEqual([]);
  });
});

describe("SiteHeader", () => {
  it("links the main navigation to the home sections and contact", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav)
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual([
      ["Home", "/"],
      ["Features", "/#features"],
      ["How it works", "/#how-it-works"],
      ["FAQ", "/#faq"],
      ["Contact", "/contact"],
    ]);
  });

  it("has a home link and a Sign in link", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "CITADEL home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });
});

describe("SiteFooter", () => {
  it("contains every FR-019 link with its exact destination", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Footer" });
    const expected: [RegExp, string][] = [
      [/^Home$/, "/"],
      [/^Features$/, "/#features"],
      [/^How it works$/, "/#how-it-works"],
      [/^FAQ$/, "/#faq"],
      [/^Sign in$/, "/sign-in"],
      [/^Contact$/, "/contact"],
      [/^Terms of Service$/, "/terms"],
      [/^Privacy Policy$/, "/privacy"],
      [/^OakSignal on GitHub/, "https://github.com/Oak-Signal"],
      [/^OakSignal website/, "https://oak-signal.github.io/oaksignal-landing/"],
    ];
    for (const [name, href] of expected) {
      expect(within(nav).getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("opens external links safely in a new tab and says so", () => {
    render(<SiteFooter />);
    for (const name of [/^OakSignal on GitHub/, /^OakSignal website/]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAccessibleName(expect.stringMatching(/\(opens in a new tab\)$/));
    }
  });

  it("shows the contact email as a mailto link with visible text", () => {
    render(<SiteFooter />);
    const mail = screen.getByRole("link", { name: EMAIL });
    expect(mail).toHaveAttribute("href", `mailto:${EMAIL}`);
    expect(mail).toHaveTextContent(EMAIL);
  });

  it("carries the Cadet Program line", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/for the Cadet Program/)).toBeInTheDocument();
  });
});

// The home page renders a <section> per area; find it by its id so the checks stay scoped.
function section(id: string) {
  const { container } = render(<HomePage />);
  const element = container.querySelector<HTMLElement>(`section#${id}`);
  if (!element) throw new Error(`Missing section #${id}`);
  return element;
}

describe("home page sections (US3)", () => {
  it("lists all nine features in order, each with its real status", () => {
    const features_ = section("features");
    expect(within(features_).getByRole("heading", { level: 2, name: "Features" })).toBeVisible();
    const names = within(features_)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(features.map((feature) => feature.name));
    const cards = within(features_).getAllByRole("listitem");
    expect(cards).toHaveLength(9);
    cards.forEach((card, index) => {
      expect(card).toHaveTextContent(FEATURE_STATUS_LABELS[features[index].status]);
    });
  });

  it("explains how it works in four ordered steps and the two portals", () => {
    const how = section("how-it-works");
    expect(within(how).getByRole("heading", { level: 2, name: "How it works" })).toBeVisible();
    const steps = within(how).getAllByRole("list")[0];
    expect(steps.tagName).toBe("OL");
    const items = within(steps).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    items.forEach((item, index) => expect(item).toHaveTextContent(howItWorksSteps[index].title));
    expect(within(how).getByRole("heading", { level: 3, name: "Two portals" })).toBeVisible();
  });

  it("states the trust principles and OakSignal's values in order", () => {
    const trust = section("trust");
    const principles = within(trust)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(principles).toEqual(trustPrinciples.map((principle) => principle.title));
    const values = within(within(trust).getByRole("list", { name: "Our values" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(values).toEqual(["Clarity", "Accessibility", "Reliability", "Maintainability"]);
  });

  it("expands one FAQ answer in place without changing the others", async () => {
    const faq = section("faq");
    const triggers = within(faq).getAllByRole("button");
    expect(triggers.map((trigger) => trigger.textContent)).toEqual(
      faqs.map((entry) => entry.question),
    );
    triggers.forEach((trigger) => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await userEvent.click(triggers[0]);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");
    triggers
      .slice(1)
      .forEach((trigger) => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("links the unit access answer to contact", async () => {
    const faq = section("faq");
    await userEvent.click(within(faq).getByRole("button", { name: "How does a unit get access?" }));
    expect(within(faq).getByRole("link", { name: "Get your unit started" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("contains no pricing, testimonials, or compliance claims", () => {
    const { container } = render(<HomePage />);
    expect(container.textContent).not.toMatch(
      /\$|price|pricing|per month|testimonial|SOC ?2|ISO ?27001|certified|compliant/i,
    );
  });
});

describe("contact page (US4)", () => {
  it("has one h1 and the three enquiry sections", () => {
    render(<ContactPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
    const sections = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(sections).toEqual(["Get your unit started", "Support", "Report a security concern"]);
  });

  it("gives the email as a mailto link with the address visible", () => {
    render(<ContactPage />);
    const links = screen.getAllByRole("link", { name: EMAIL });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", `mailto:${EMAIL}`);
      expect(link).toHaveTextContent(EMAIL);
    }
  });

  it("explains that units are set up on request, not by self-registration", () => {
    render(<ContactPage />);
    const onboarding = screen.getByRole("region", { name: "Get your unit started" });
    expect(onboarding).toHaveTextContent(/set up for each unit by the platform/i);
    expect(onboarding).toHaveTextContent(/no self-registration/i);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.filter((href) => href.includes("/sign-up"))).toEqual([]);
  });

  it("sends security reports to private email, not public issues", () => {
    render(<ContactPage />);
    const security = screen.getByRole("region", { name: "Report a security concern" });
    expect(security).toHaveTextContent(/privately/i);
    expect(security).toHaveTextContent(/public issue/i);
  });
});

// FR-016, FR-017, SC-008: accurate drafts, clearly flagged, with no unsupported claims.
const UNSUPPORTED_CLAIMS =
  /SOC ?2|ISO ?27001|HIPAA|certified|accredited|fully compliant|GDPR[- ]compliant|PIPEDA[- ]compliant|guarantee/i;

describe.each([
  { name: "Terms of Service", Page: TermsPage },
  { name: "Privacy Policy", Page: PrivacyPage },
])("$name page (US5)", ({ name, Page }) => {
  it("has one h1 followed immediately by the draft notice", () => {
    render(<Page />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(name);
    const next = headings[0].nextElementSibling;
    expect(next).toHaveAttribute("role", "note");
    expect(next).toHaveTextContent(/draft/i);
    expect(next).toHaveTextContent(/review/i);
  });

  it("shows when it was last updated", () => {
    render(<Page />);
    expect(screen.getByText(/Last updated/)).toHaveTextContent("2026-11-14");
  });

  it("makes no certification, compliance, or guarantee claims", () => {
    const { container } = render(<Page />);
    expect(container.textContent).not.toMatch(UNSUPPORTED_CLAIMS);
  });

  it("gives the contact email", () => {
    render(<Page />);
    expect(screen.getAllByRole("link", { name: EMAIL })[0]).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`,
    );
  });
});

describe("privacy policy content (US5)", () => {
  it("describes how CITADEL really handles data", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/third-party authentication service/i);
    expect(text).toMatch(/does not store (your )?passwords/i);
    expect(text).toMatch(/only (to|by) (that|its) unit's members|isolated from other units/i);
    expect(text).toMatch(/audit history/i);
    expect(text).toMatch(/anonymi[sz]ed/i);
    expect(text).toMatch(/7 years/);
    expect(text).toMatch(/no analytics/i);
  });
});
