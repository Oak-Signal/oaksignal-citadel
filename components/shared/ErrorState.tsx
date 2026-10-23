import type { ReactNode } from "react";

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the problem continues, contact your unit administrator.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-10 text-center"
    >
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-foreground/80">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
