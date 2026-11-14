import type { ReactNode } from "react";
import { PortalLayout } from "@/components/shared/PortalLayout";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <PortalLayout portal="platform">{children}</PortalLayout>;
}
