"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountMenu } from "@/components/shared/AccountMenu";
import { useAccess } from "@/components/shared/AccessProvider";
import { Loading } from "@/components/shared/Loading";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultPath } from "@/lib/portal";

const MESSAGES = {
  no_unit: {
    title: "You are not part of a unit yet",
    description:
      "Ask a unit administrator to invite you using the email address you signed in with. Once you accept the invitation you will see your unit here.",
  },
  inactive: {
    title: "Your membership is inactive",
    description:
      "A unit administrator has deactivated your access. Contact them if you think this is a mistake. Any equipment issued to you stays on your unit's records.",
  },
} as const;

export default function NoAccessPage() {
  const { access, activeUnit } = useAccess();
  const router = useRouter();
  const target = defaultPath(access, activeUnit);
  const waiting = access.state === "signed_out" || access.state === "syncing";

  // Someone who does have access (or a pending invitation) should not stay on this page.
  useEffect(() => {
    if (target && target !== "/no-access") router.replace(target);
  }, [target, router]);

  const message = access.state === "inactive" ? MESSAGES.inactive : MESSAGES.no_unit;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        {waiting || (target && target !== "/no-access") ? (
          <CardContent>
            <Loading />
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>
                <h1>{message.title}</h1>
              </CardTitle>
              <CardDescription>{message.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Link href="/" className={buttonVariants({ variant: "outline" })}>
                Check again
              </Link>
              <AccountMenu />
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
