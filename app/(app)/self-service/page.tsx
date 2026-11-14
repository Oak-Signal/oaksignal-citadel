"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAccess } from "@/components/shared/AccessProvider";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionLinks } from "@/components/shared/SectionLinks";
import { StatTile } from "@/components/shared/StatTile";
import { NAV_CONFIG } from "@/components/shared/nav-config";
import { buttonVariants } from "@/components/ui/button";
import { roleLabel } from "@/lib/permissions";

export default function SelfServicePage() {
  const { activeUnit } = useAccess();
  const unitId = activeUnit?.unitId;
  const equipment = useQuery(api.selfService.myAssignments, unitId ? { unitId } : "skip");
  const requests = useQuery(api.selfService.myRequests, unitId ? { unitId } : "skip");
  const links = NAV_CONFIG["self-service"].filter((item) => item.description);

  return (
    <>
      <PageHeader
        title="My CITADEL"
        description={
          activeUnit
            ? `${activeUnit.name} · ${activeUnit.roles.map(roleLabel).join(", ")}`
            : undefined
        }
        actions={
          <Link href="/self-service/requests" className={buttonVariants({ variant: "default" })}>
            Request equipment
          </Link>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Items on loan" value={equipment?.length} href="/self-service/equipment" />
        <StatTile
          label="Overdue"
          value={equipment?.filter((row) => row.overdue).length}
          href="/self-service/equipment"
          tone="alert"
        />
        <StatTile
          label="Open requests"
          value={
            requests?.filter(
              (r) =>
                r.status === "submitted" ||
                r.status === "approved" ||
                r.status === "partially_fulfilled",
            ).length
          }
          href="/self-service/requests"
        />
      </div>
      <SectionLinks sections={[{ items: links }]} />
    </>
  );
}
