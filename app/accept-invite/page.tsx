"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AccountMenu } from "@/components/shared/AccountMenu";
import { useAccess } from "@/components/shared/AccessProvider";
import { Loading } from "@/components/shared/Loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/errors";
import { roleLabel } from "@/lib/permissions";

export default function AcceptInvitePage() {
  const { access } = useAccess();
  const router = useRouter();
  const accept = useMutation(api.memberships.accept);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept(membershipId: Id<"memberships">) {
    setPending(membershipId);
    setError(null);
    try {
      await accept({ membershipId });
      router.replace("/");
    } catch (caught) {
      setError(getErrorMessage(caught));
      setPending(null);
    }
  }

  const waiting = access.state === "signed_out" || access.state === "syncing";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            <h1>Unit invitations</h1>
          </CardTitle>
          <CardDescription>
            Accept an invitation to join a unit. Your access matches the roles you were given.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {waiting ? <Loading /> : null}
          {!waiting && access.invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no pending invitations.</p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {access.invitations.map((invitation) => (
              <li
                key={invitation.membershipId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{invitation.unitName}</p>
                  <p className="text-sm text-muted-foreground">
                    {invitation.roles.map(roleLabel).join(", ")}
                  </p>
                </div>
                <Button
                  disabled={pending !== null}
                  onClick={() => void handleAccept(invitation.membershipId)}
                  aria-label={`Accept invitation to ${invitation.unitName}`}
                >
                  {pending === invitation.membershipId ? "Accepting..." : "Accept"}
                </Button>
              </li>
            ))}
          </ul>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <AccountMenu />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
