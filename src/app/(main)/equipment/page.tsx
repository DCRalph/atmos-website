import { EquipmentWizard } from "~/components/site/equipment/equipment-wizard";
import { pageMetadata } from "~/lib/seo-constants";

export const metadata = pageMetadata({
  title: "Equipment",
  description: "Rent professional audio and event packages from ATMOS.",
  path: "/equipment",
});

export default function EquipmentPage() {
  return <EquipmentWizard />;
}
