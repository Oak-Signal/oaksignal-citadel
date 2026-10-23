"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccess } from "@/components/shared/AccessProvider";
import { Loading } from "@/components/shared/Loading";
import { defaultPath } from "@/lib/portal";

// Entry point after sign-in: sends each user to the portal their role allows, or to the
// onboarding page that matches their membership state.
export default function Home() {
  const { access, activeUnit } = useAccess();
  const router = useRouter();
  const target = defaultPath(access, activeUnit);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <Loading label="Signing you in..." />
    </main>
  );
}
