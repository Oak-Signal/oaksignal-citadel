// Public site content: the single source for everything on the marketing pages that depends on
// the product's real state (feature status, FAQ answers, links, contact). Keep claims limited to
// what CITADEL enforces today. No React imports, so tests and metadata can use it directly.

export const site = {
  name: "CITADEL",
  expansion: "Centralized Inventory Tracking, Asset Distribution, Equipment & Logistics",
  valueStatement: "Inventory and accountability for cadet units",
  summary:
    "Track serialized equipment and bulk stock, issue and receive it with confidence, and keep a permanent record of every change, from the supply room to the cadet.",
  tagline: "Developing the tools that support the next generation of leaders",
  description:
    "CITADEL is OakSignal's free inventory management system for cadet units: track equipment, issue and return it, and keep a permanent record of who changed what.",
} as const;

// Short, factual highlights shown under the hero actions.
export const heroHighlights = [
  "Unit-scoped access",
  "Issue and return tracking",
  "Permanent audit history",
] as const;

export const disclaimer = {
  title: "Important disclaimer",
  body: "OakSignal is a privately developed software initiative and is not an official system of the Department of National Defence (DND), the Canadian Armed Forces (CAF), or the Cadets and Junior Canadian Rangers (CJCR). While our tools are designed to align with cadet program structures and policies, they are independent third-party solutions.",
  short: "Not an official DND/CAF/CJCR system. Independently developed.",
} as const;

export type FeatureStatus = "available" | "coming_soon";

// Lucide icon names; components/site maps them to icon components.
export type FeatureIconName =
  | "ShieldCheck"
  | "Building2"
  | "ScrollText"
  | "Boxes"
  | "ArrowLeftRight"
  | "UserRound"
  | "History"
  | "LayoutDashboard"
  | "Warehouse";

export type FeatureEntry = {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  icon: FeatureIconName;
};

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  available: "Available",
  coming_soon: "Coming soon",
};

// FR-009 order. Update `status` here when a capability ships (FR-010).
export const features: FeatureEntry[] = [
  {
    id: "secure-access",
    name: "Secure access",
    description:
      "Sign-in, unit-scoped roles and permissions, member invitations, and separate portals for cadets and staff.",
    status: "available",
    icon: "ShieldCheck",
  },
  {
    id: "unit-onboarding",
    name: "Unit onboarding",
    description:
      "Units are set up by the platform, the first administrator is verified, and members join by invitation.",
    status: "available",
    icon: "Building2",
  },
  {
    id: "audit-foundation",
    name: "Audit foundation",
    description:
      "Every important change is written to an append-only log in the same step as the change itself.",
    status: "available",
    icon: "ScrollText",
  },
  {
    id: "inventory-catalogue",
    name: "Inventory catalogue",
    description:
      "Track serialized assets such as radios and laptops alongside bulk and consumable stock with low-stock thresholds.",
    status: "available",
    icon: "Boxes",
  },
  {
    id: "issuance-returns",
    name: "Issuance and returns",
    description:
      "Record what was issued to whom, when it is due back, and the condition it came back in.",
    status: "available",
    icon: "ArrowLeftRight",
  },
  {
    id: "cadet-self-service",
    name: "Cadet self-service",
    description:
      "Cadets see the equipment they hold, request what they need, and report damaged or missing items.",
    status: "available",
    icon: "UserRound",
  },
  {
    id: "audit-trail-views",
    name: "Audit trail views",
    description:
      "Authorized staff search the accountability history by person, record, action, and date.",
    status: "available",
    icon: "History",
  },
  {
    id: "dashboards-reports",
    name: "Dashboards and reports",
    description: "Stock levels, overdue items, low-stock notifications, and data exports.",
    status: "coming_soon",
    icon: "LayoutDashboard",
  },
  {
    id: "locations-stocktaking",
    name: "Locations and stocktaking",
    description: "Multiple storage locations, maintenance tracking, and reconciled stocktakes.",
    status: "coming_soon",
    icon: "Warehouse",
  },
];

export type HowItWorksStep = { order: 1 | 2 | 3 | 4; title: string; description: string };

// FR-011 order.
export const howItWorksSteps: HowItWorksStep[] = [
  {
    order: 1,
    title: "Your unit is set up",
    description:
      "A unit leader contacts OakSignal and the unit is provisioned on the platform. There is no open sign-up.",
  },
  {
    order: 2,
    title: "Your first administrator is verified",
    description:
      "The unit's first administrator is invited and verified before they can manage the unit.",
  },
  {
    order: 3,
    title: "Members are invited and given roles",
    description:
      "Administrators invite members by email and give each person roles that match their responsibilities.",
  },
  {
    order: 4,
    title: "Equipment is issued and tracked",
    description:
      "Staff issue, receive, and account for equipment, while cadets use self-service to see what they hold and ask for more.",
  },
];

export const portals = [
  {
    name: "Self-service",
    description:
      "For cadets: see the equipment you hold and when it is due back, request what you need, and report problems.",
  },
  {
    name: "Operator",
    description:
      "For staff: manage the inventory, issue and receive equipment, approve requests, and review the audit history.",
  },
] as const;

export const permissionsSummary =
  "What each member can see and do follows their roles within their own unit.";

export const trustPrinciples = [
  {
    title: "Unit data isolation",
    description:
      "Each unit's records are visible only to that unit's members. Every request is checked on the server, so changing a web address cannot reveal another unit's data.",
  },
  {
    title: "Role-based permissions",
    description:
      "Roles decide what a member can see and do, and the server enforces them on every action instead of only hiding buttons.",
  },
  {
    title: "Permanent audit history",
    description:
      "Important changes record who made them, when, and what changed. Past transactions cannot be edited; mistakes are corrected with new, traceable entries.",
  },
  {
    title: "Accessible by design",
    description:
      "Designed to meet WCAG 2.1 AA, usable with a keyboard and screen reader, and built for phones, tablets, and desktops.",
  },
] as const;

export const values = ["Clarity", "Accessibility", "Reliability", "Maintainability"] as const;

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  link?: { label: string; href: string };
};

// Covers every FR-013 topic.
export const faqs: FaqEntry[] = [
  {
    id: "who-for",
    question: "Who is CITADEL for?",
    answer:
      "Cadet units that need to track equipment and keep people accountable for it: unit leaders, supply and logistics staff, officers, and the cadets who are issued equipment.",
  },
  {
    id: "cost",
    question: "What does CITADEL cost?",
    answer: "CITADEL is free for cadet units. There are no plans or paid tiers.",
  },
  {
    id: "access",
    question: "How does a unit get access?",
    answer:
      "Units are set up by the platform, not through open sign-up. A unit leader contacts OakSignal, the unit is provisioned, and its first administrator is verified. Members then join by email invitation from their unit.",
    link: { label: "Get your unit started", href: "/contact" },
  },
  {
    id: "who-sees-what",
    question: "Who can see what?",
    answer:
      "Members only ever see their own unit. Within it, their roles decide what they can see and do: cadets see their own equipment and requests, while staff see what their responsibilities require.",
  },
  {
    id: "privacy",
    question: "How is our unit's data kept private?",
    answer:
      "Each unit's data is kept separate from every other unit, and every request is checked on the server. Important changes are permanently recorded. Personal details of former members are anonymized after the unit's retention period, which is 7 years by default.",
    link: { label: "Read the draft privacy policy", href: "/privacy" },
  },
  {
    id: "devices",
    question: "What devices does CITADEL work on?",
    answer:
      "CITADEL runs in a modern web browser on phones, tablets, and desktops, with nothing to install. It is designed to meet WCAG 2.1 AA and to work with a keyboard and a screen reader.",
  },
  {
    id: "help",
    question: "How do I get help?",
    answer:
      "Members should start with their unit administrator. For onboarding or support, email OakSignal. Please report security concerns privately by email, not in public issues.",
    link: { label: "Contact OakSignal", href: "/contact" },
  },
];

export type NavLink = { label: string; href: string; external?: boolean };

export const signInLink: NavLink = { label: "Sign in", href: "/sign-in" };

export const headerLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/contact" },
];

export const footerLinkGroups: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "FAQ", href: "/#faq" },
      signInLink,
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "OakSignal on GitHub", href: "https://github.com/Oak-Signal", external: true },
      {
        label: "OakSignal website",
        href: "https://oak-signal.github.io/oaksignal-landing/",
        external: true,
      },
    ],
  },
];

// FR-019 order across the groups.
export const footerLinks: NavLink[] = footerLinkGroups.flatMap((group) => group.links);

export const contact = {
  email: "contact.oaksignal@gmail.com",
  onboarding: {
    title: "Get your unit started",
    body: "CITADEL is set up for each unit by the platform; there is no self-registration. Email us with your unit's name and who will act as its first administrator, and we will guide you through provisioning and verification.",
  },
  support: {
    title: "Support",
    body: "Members should first ask their unit administrator, who can manage roles, invitations, and records. Administrators and staff can email us about problems they cannot resolve within the unit.",
  },
  security: {
    title: "Report a security concern",
    body: "Please report suspected vulnerabilities privately by email. Do not post them in public issues or discussions. Describe what you found and how to reproduce it, and we will respond as soon as we can.",
  },
} as const;
