import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

// A headline count that links to the page where it can be acted on. `tone="alert"` adds a
// text cue so urgency is never shown by colour alone.
export function StatTile({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number | undefined;
  href: string;
  tone?: "default" | "alert";
}) {
  const needsAttention = tone === "alert" && (value ?? 0) > 0;
  return (
    <Card className={needsAttention ? "border-destructive/50" : undefined}>
      <CardContent className="flex flex-col gap-1">
        <Link
          href={href}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {label}
        </Link>
        <p className="text-3xl font-semibold tabular-nums">
          {value === undefined ? <span aria-label="Loading">…</span> : value}
        </p>
        {needsAttention ? (
          <p className="text-xs font-medium text-destructive">Needs attention</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
