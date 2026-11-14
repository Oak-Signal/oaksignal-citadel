import type { ComponentProps } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Link to another site. Opens in a new tab, says so to assistive technology, and drops the
// opener reference.
export function ExternalLink({
  href,
  children,
  className,
  ...props
}: Omit<ComponentProps<"a">, "target" | "rel">) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    >
      {children}
      <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
