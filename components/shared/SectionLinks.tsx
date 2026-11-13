import Link from "next/link";
import type { NavSection } from "@/components/shared/nav-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Dashboard links grouped like the sidebar. Sub-pages are listed alongside their parents.
export function SectionLinks({ sections }: { sections: NavSection[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <Card key={section.title ?? "top"}>
          {section.title ? (
            <CardHeader>
              <CardTitle>
                <h2>{section.title}</h2>
              </CardTitle>
            </CardHeader>
          ) : null}
          <CardContent>
            <ul className="flex flex-col gap-3">
              {section.items
                .flatMap((item) => [item, ...(item.children ?? [])])
                .map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {item.label}
                    </Link>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
