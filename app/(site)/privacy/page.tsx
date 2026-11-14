import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { MailLink } from "@/components/site/MailLink";
import { contact } from "@/lib/site-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy (draft)",
  description:
    "Draft policy describing how CITADEL handles personal and unit information for cadet units.",
  path: "/privacy",
});

const UPDATED = "2026-11-14";

// Every statement here must match what CITADEL actually does (FR-017, research R-10).
const SECTIONS: LegalSection[] = [
  {
    id: "scope",
    title: "Who this policy covers",
    body: (
      <>
        <p>
          This policy explains how CITADEL, operated by OakSignal, handles information about the
          members of cadet units who use it, including cadets, staff, officers, and unit
          administrators.
        </p>
        <p>
          Many cadets are young people. CITADEL collects only the information needed to track
          equipment and keep members accountable for it.
        </p>
      </>
    ),
  },
  {
    id: "information",
    title: "Information CITADEL holds",
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, roles, and unit memberships,
          including whether a membership is invited, active, or inactive.
        </li>
        <li>
          <strong>Equipment records:</strong> what was issued to you and returned, condition notes,
          due dates, equipment requests, and reports of damaged or missing items.
        </li>
        <li>
          <strong>Item images and attachments</strong> that staff upload to equipment records.
        </li>
        <li>
          <strong>Audit history:</strong> who made each important change and when, including sign-in
          and sign-out times.
        </li>
        <li>
          <strong>Notifications</strong> CITADEL sends you inside the app.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How the information is used",
    body: (
      <p>
        Information is used only to run CITADEL for your unit: tracking equipment, showing members
        what they hold, handling requests and approvals, and keeping an accountability record. It is
        not sold and is not used for advertising.
      </p>
    ),
  },
  {
    id: "sign-in",
    title: "Sign-in",
    body: (
      <p>
        Sign-in is provided by Clerk, a third-party authentication service. CITADEL does not store
        passwords; your sign-in credentials are handled by Clerk under its own privacy policy.
        CITADEL receives your name, email address, and an account identifier so it can link you to
        your unit membership.
      </p>
    ),
  },
  {
    id: "storage",
    title: "Where information is stored",
    body: (
      <p>
        CITADEL&apos;s data and server functions run on Convex, and the website is hosted on Vercel.
        Information is encrypted in transit using TLS. Protection of stored data is provided by our
        hosting providers.
      </p>
    ),
  },
  {
    id: "access",
    title: "Who can see your information",
    body: (
      <ul>
        <li>
          Each unit&apos;s records are isolated from other units and are visible only to that
          unit&apos;s members. Permissions are checked on the server for every request.
        </li>
        <li>
          Within a unit, your roles decide what you can see: cadets see their own equipment and
          requests, while staff see what their responsibilities require.
        </li>
        <li>
          Platform administrators set up units. They can act inside a unit only through time-limited
          support access that an officer or logistics officer of that unit has verified, and that
          access is recorded in the unit&apos;s audit history.
        </li>
        <li>The service providers named above process data on OakSignal&apos;s behalf.</li>
      </ul>
    ),
  },
  {
    id: "audit",
    title: "Audit history",
    body: (
      <p>
        Important changes, such as issuing or returning equipment, stock adjustments, and role
        changes, are recorded permanently in the unit&apos;s audit history. Entries cannot be edited
        or deleted; corrections are recorded as new entries. This is how CITADEL keeps equipment
        accountable.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long information is kept",
    body: (
      <>
        <p>
          When a member leaves or is deactivated, the unit&apos;s history is kept so that equipment
          stays accountable.
        </p>
        <p>
          After the unit&apos;s retention period, the former member&apos;s name and email address
          are anonymized and replaced with an anonymous label. The retention period is 7 years by
          default, and each unit&apos;s administrators can change it. Records stay attributed to the
          anonymous label, so the history remains complete.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and tracking",
    body: (
      <p>
        CITADEL uses no analytics, advertising, or tracking cookies, and the public pages load no
        tracking scripts. Signing in uses functional cookies set by the authentication service,
        which are needed to keep you signed in.
      </p>
    ),
  },
  {
    id: "your-information",
    title: "Accessing or correcting your information",
    body: (
      <p>
        To see or correct your information, ask your unit administrator first; they manage
        memberships and records for your unit. You can also email <MailLink email={contact.email} />
        . Because the audit history is permanent, corrections are added as new entries rather than
        by changing past ones.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        This policy may be updated as CITADEL develops. When it changes, this page and the date at
        the top will be updated. Read it together with the{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Privacy questions can be sent to <MailLink email={contact.email} />, or see the{" "}
        <Link href="/contact">Contact page</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="How CITADEL handles information about the members of cadet units."
      updated={UPDATED}
      sections={SECTIONS}
    />
  );
}
