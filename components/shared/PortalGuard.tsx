"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/components/shared/AccessProvider";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { Loading } from "@/components/shared/Loading";
import { decidePortal, defaultPath } from "@/lib/portal";
import type { Portal } from "@/lib/types";

// Role-aware portal routing: renders the portal only when the user's role allows it, shows the
// access-denied page for a restricted URL, and redirects users with no active membership to
// their onboarding page.
export function PortalGuard({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { access, activeUnit } = useAccess();
  const router = useRouter();
  const decision = decidePortal(portal, access, activeUnit);
  const redirectTo =
    decision === "no-access" ? (defaultPath(access, activeUnit) ?? "/no-access") : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (decision === "deny") {
    return (
      <div className="p-6">
        <AccessDenied />
      </div>
    );
  }
  if (decision !== "allow") return <Loading label="Checking your access..." />;
  return <>{children}</>;
}
