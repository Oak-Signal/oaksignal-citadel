"use client";

import { useMutation } from "convex/react";
import { UserButton, useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

// Account controls for the shell header. Sign-out records an audit entry first (best effort),
// then ends the Clerk session and returns to /sign-in.
export function AccountMenu() {
  const { signOut } = useClerk();
  const recordSignOut = useMutation(api.users.recordSignOut);

  async function handleSignOut() {
    try {
      await recordSignOut({});
    } catch {
      // Never block sign-out on an audit failure.
    }
    await signOut({ redirectUrl: "/sign-in" });
  }

  return (
    <div className="flex items-center gap-2">
      <UserButton />
      <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </div>
  );
}
