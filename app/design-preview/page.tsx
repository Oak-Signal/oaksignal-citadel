import { notFound } from "next/navigation";
import { DesignPreview } from "./DesignPreview";

export const metadata = { title: "Design preview | CITADEL" };

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignPreview />;
}
