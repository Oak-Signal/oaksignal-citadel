import { FileWarningIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// FR-016: legal pages are drafts until OakSignal and the appropriate authority approve them.
export function DraftNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      aria-label="Draft notice"
      className={cn(
        "flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-left sm:p-5",
        className,
      )}
    >
      <FileWarningIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">Draft for review</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Draft: this page has not yet been reviewed. It must be reviewed and approved by OakSignal
          and the appropriate cadet program authority before CITADEL is used with real unit data.
        </p>
      </div>
    </div>
  );
}
