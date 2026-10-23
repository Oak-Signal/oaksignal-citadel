// Shared types and data contracts used by both the Next.js client and Convex.
export type { Id, Doc } from "@/convex/_generated/dataModel";
export type { Permission, RoleKey, MembershipGrants } from "@/convex/lib/permissions";
export type { AppErrorCode, AppErrorData } from "@/convex/lib/errors";

export type Portal = "self-service" | "operator" | "platform";

export type NavItem = {
  label: string;
  href: string;
  // Permission needed to see the link. Omit for links every active member can use.
  permission?: import("@/convex/lib/permissions").Permission;
};

export type NavConfig = Record<Portal, NavItem[]>;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
