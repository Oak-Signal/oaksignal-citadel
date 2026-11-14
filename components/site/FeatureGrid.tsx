import {
  ArrowLeftRightIcon,
  BoxesIcon,
  Building2Icon,
  HistoryIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  WarehouseIcon,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FEATURE_STATUS_LABELS,
  features,
  type FeatureIconName,
  type FeatureStatus,
} from "@/lib/site-content";
import { cn } from "@/lib/utils";

const ICONS: Record<FeatureIconName, LucideIcon> = {
  ShieldCheck: ShieldCheckIcon,
  Building2: Building2Icon,
  ScrollText: ScrollTextIcon,
  Boxes: BoxesIcon,
  ArrowLeftRight: ArrowLeftRightIcon,
  UserRound: UserRoundIcon,
  History: HistoryIcon,
  LayoutDashboard: LayoutDashboardIcon,
  Warehouse: WarehouseIcon,
};

const STATUS_VARIANT: Record<FeatureStatus, "success" | "outline"> = {
  available: "success",
  coming_soon: "outline",
};

// FR-009 / FR-010: every capability with its real status, all read from lib/site-content.ts.
export function FeatureGrid() {
  return (
    <section id="features" aria-labelledby="features-heading" className="bg-card py-20 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 sm:px-6">
        <SectionHeading
          id="features-heading"
          eyebrow="What CITADEL does"
          title="Features"
          description="Everything a unit needs to know where its equipment is and who is responsible for it. Each capability is marked honestly: available today, or coming soon."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = ICONS[feature.icon];
            const available = feature.status === "available";
            return (
              <li key={feature.id} className="flex">
                <Card
                  className={cn(
                    "w-full transition-shadow hover:shadow-md motion-reduce:transition-none",
                    !available && "bg-muted/40",
                  )}
                >
                  <CardHeader className="gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg",
                        available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <CardAction>
                      <Badge variant={STATUS_VARIANT[feature.status]}>
                        {FEATURE_STATUS_LABELS[feature.status]}
                      </Badge>
                    </CardAction>
                    <CardTitle>
                      <h3 className="text-base font-semibold">{feature.name}</h3>
                    </CardTitle>
                    <CardDescription className="leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
