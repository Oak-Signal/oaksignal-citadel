"use client";

import type { ReactNode } from "react";
import { AccountMenu } from "@/components/shared/AccountMenu";
import { AppShell } from "@/components/shared/AppShell";
import { PortalGuard } from "@/components/shared/PortalGuard";
import { UnitSwitcher } from "@/components/shared/UnitSwitcher";
import { NAV_CONFIG } from "@/components/shared/nav-config";
import type { Portal } from "@/lib/types";

export function PortalLayout({ portal, children }: { portal: Portal; children: ReactNode }) {
  return (
    <PortalGuard portal={portal}>
      <AppShell
        portal={portal}
        navItems={NAV_CONFIG[portal]}
        accountMenu={
          <div className="flex flex-wrap items-center gap-3">
            {portal === "platform" ? null : <UnitSwitcher />}
            <AccountMenu />
          </div>
        }
      >
        {children}
      </AppShell>
    </PortalGuard>
  );
}
