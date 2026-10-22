"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";

function RedirectToSignIn() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);
  return null;
}

// Wraps protected pages: shows a loading state while the session resolves, renders children
// when authenticated, and sends signed-out or expired sessions back to /sign-in.
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <p role="status" className="p-6 text-sm text-muted-foreground">
          Loading your session...
        </p>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
}
