import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>CITADEL (CIMS)</CardTitle>
          <CardDescription>
            Oak Signal inventory management for cadet units. Setup placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button>Stack check</Button>
          <span className="text-sm text-muted-foreground">
            Next.js, Tailwind CSS, and shadcn/ui are working.
          </span>
        </CardContent>
      </Card>
    </main>
  );
}
