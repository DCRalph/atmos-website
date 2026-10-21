import { AdminSection } from "~/components/admin/admin-section";
import { ReportList } from "~/components/admin/reports/report-list";

export default function ReportsPage() {
  return (
    <AdminSection
      title="Reports"
      description="Reports and analysis created with Will GPT."
    >
      <ReportList />
    </AdminSection>
  );
}
