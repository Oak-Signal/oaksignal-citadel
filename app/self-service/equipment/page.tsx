import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export default function MyEquipmentPage() {
  return (
    <>
      <PageHeader title="My equipment" />
      <EmptyState
        title="Nothing issued to you"
        description="Equipment tracking arrives in a later release. Items issued to you will be listed here."
      />
    </>
  );
}
