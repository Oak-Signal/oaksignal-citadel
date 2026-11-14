import type { ReactNode } from "react";
import { PortalLayout } from "@/components/shared/PortalLayout";

export default function SelfServiceLayout({ children }: { children: ReactNode }) {
  return <PortalLayout portal="self-service">{children}</PortalLayout>;
}
