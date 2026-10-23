import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export default function MyRequestsPage() {
  return (
    <>
      <PageHeader title="My requests" />
      <EmptyState
        title="No requests yet"
        description="Equipment requests arrive in a later release. Your requests will be listed here."
      />
    </>
  );
}
