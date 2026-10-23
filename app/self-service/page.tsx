"use client";

import Link from "next/link";
import { useAccess } from "@/components/shared/AccessProvider";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roleLabel } from "@/lib/permissions";

export default function SelfServicePage() {
  const { activeUnit } = useAccess();
  return (
    <>
      <PageHeader
        title="My CITADEL"
        description={
          activeUnit
            ? `${activeUnit.name} · ${activeUnit.roles.map(roleLabel).join(", ")}`
            : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>My equipment</h2>
            </CardTitle>
            <CardDescription>Items issued to you will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/self-service/equipment"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View my equipment
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>My requests</h2>
            </CardTitle>
            <CardDescription>Request equipment and follow its approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/self-service/requests"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View my requests
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
