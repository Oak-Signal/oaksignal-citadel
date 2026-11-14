import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { MailLink } from "@/components/site/MailLink";
import { contact, disclaimer } from "@/lib/site-content";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service (draft)",
  description:
    "Draft terms for using CITADEL, OakSignal's inventory and accountability system for cadet units.",
  path: "/terms",
});

const UPDATED = "2026-11-14";

const SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          These terms explain how CITADEL may be used. CITADEL is an inventory and accountability
          system for cadet units, built and operated by OakSignal and offered free of charge to
          cadet units.
        </p>
        <p>{disclaimer.body}</p>
        <p>By signing in to CITADEL, you agree to these terms.</p>
      </>
    ),
  },
  {
    id: "who-may-use",
    title: "Who may use CITADEL",
    body: (
      <>
        <p>
          CITADEL is available only to members of cadet units that the platform has set up. There is
          no open sign-up: a unit is provisioned on request, its first administrator is verified,
          and members join by an email invitation from their unit.
        </p>
        <ul>
          <li>Your account is personal. Do not share it or let anyone else sign in as you.</li>
          <li>
            You can see and do only what your roles in your own unit allow. Access to another unit
            is never granted by being a member of yours.
          </li>
          <li>
            If you leave your unit, your access ends when an administrator deactivates your
            membership.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Use CITADEL only to manage your unit&apos;s equipment and accountability. Do not:</p>
        <ul>
          <li>try to view or change another unit&apos;s data, or get around your permissions;</li>
          <li>record information you know to be false or misleading;</li>
          <li>
            upload anything unlawful or harmful, or include personal information in notes, images,
            or attachments beyond what a record needs;
          </li>
          <li>interfere with the service, or test its security without permission.</li>
        </ul>
        <p>
          If you find a security problem, report it privately to OakSignal at{" "}
          <MailLink email={contact.email} /> and not in public issues.
        </p>
      </>
    ),
  },
  {
    id: "administrators",
    title: "Responsibilities of unit administrators",
    body: (
      <ul>
        <li>Invite only people who belong to your unit, and give each the roles they need.</li>
        <li>Deactivate members promptly when they leave the unit.</li>
        <li>
          Keep the unit&apos;s settings, including its retention period for former members&apos;
          personal details, appropriate for your unit.
        </li>
        <li>Follow your cadet program&apos;s policies on equipment and on personal information.</li>
      </ul>
    ),
  },
  {
    id: "records",
    title: "Records and the audit history",
    body: (
      <>
        <p>
          Members are responsible for the accuracy of the records they create, such as issues,
          returns, adjustments, requests, and incident reports.
        </p>
        <p>
          Important changes are recorded in a permanent audit history showing who did what and when.
          Past transactions cannot be edited or deleted; mistakes are corrected with new, traceable
          entries. Authorized staff in your unit can review this history.
        </p>
      </>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and removal of access",
    body: (
      <p>
        Unit administrators can deactivate a membership at any time. OakSignal may suspend access
        where needed to protect the service, a unit, or its members. Deactivation removes access but
        keeps the unit&apos;s history, so equipment stays accountable.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and no warranty",
    body: (
      <>
        <p>
          CITADEL is in active development. Features marked &quot;Coming soon&quot; are not yet
          available, and existing features may change.
        </p>
        <p>
          CITADEL is provided &quot;as is&quot;, without warranties of any kind. OakSignal does not
          promise that it will always be available or free of errors. Units should keep any records
          their cadet program requires in addition to CITADEL.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        These terms may be updated as CITADEL develops. When they change, this page and the date at
        the top will be updated. Read them together with the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms can be sent to <MailLink email={contact.email} />, or see the{" "}
        <Link href="/contact">Contact page</Link>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="The rules for using CITADEL, written in plain language."
      updated={UPDATED}
      sections={SECTIONS}
    />
  );
}
