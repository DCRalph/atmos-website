import { AdminSection } from "~/components/admin/admin-section";
import { WillGptHistory } from "~/components/admin/will-gpt/will-gpt-history";

export default function WillGptHistoryPage() {
  return (
    <AdminSection
      title="Will GPT"
      description="Who asked Will GPT for what, and what it changed."
      maxWidth="max-w-4xl"
    >
      <WillGptHistory />
    </AdminSection>
  );
}
