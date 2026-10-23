"use client";

import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Creates or refreshes the application profile once a Clerk session is connected to Convex.
// Renders nothing. Failures are ignored here; protected functions fail closed without a profile.
export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);

  useEffect(() => {
    if (isAuthenticated) void syncCurrentUser({}).catch(() => undefined);
  }, [isAuthenticated, syncCurrentUser]);

  return null;
}
