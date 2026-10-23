import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Shown when a signed-in user opens a page their role does not allow. It names no data from
// the page they tried to reach.
export function AccessDenied({
  title = "Access denied",
  description = "Your role in this unit does not include access to this page. Ask a unit administrator if you need it.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border p-10 text-center"
    >
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Go to my home page
      </Link>
    </div>
  );
}
