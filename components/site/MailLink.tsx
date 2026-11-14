import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Email link whose visible text is the address itself, so it can still be read and copied
// when no email application is configured.
export function MailLink({
  email,
  className,
  ...props
}: { email: string } & Omit<ComponentProps<"a">, "href" | "children">) {
  return (
    <a
      href={`mailto:${email}`}
      className={cn(
        "font-medium [overflow-wrap:anywhere] text-primary underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    >
      {email}
    </a>
  );
}
