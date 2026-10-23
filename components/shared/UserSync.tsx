"use client";

import { useEffect, useRef } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Creates or refreshes the application profile once a Clerk session is connected to Convex.
// When the profile has no email (the session token carried none), asks the server to look up the
// verified email from Clerk, which also attaches and activates any invitations for it.
// Renders nothing. Failures are ignored here; protected functions fail closed without a profile.
export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const syncFromClerk = useAction(api.users.syncFromClerk);
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const lookedUp = useRef(false);

  useEffect(() => {
    if (isAuthenticated) void syncCurrentUser({}).catch(() => undefined);
    else lookedUp.current = false;
  }, [isAuthenticated, syncCurrentUser]);

  useEffect(() => {
    if (!me || me.email || lookedUp.current) return;
    lookedUp.current = true;
    void syncFromClerk({}).catch(() => undefined);
  }, [me, syncFromClerk]);

  return null;
}
