import type { ReactNode } from "react";
import { PortalLayout } from "@/components/shared/PortalLayout";

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return <PortalLayout portal="operator">{children}</PortalLayout>;
}
