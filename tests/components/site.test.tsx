import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/(site)/page";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

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
