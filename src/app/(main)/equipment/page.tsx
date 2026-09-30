import { type Metadata } from "next";
import { EquipmentWizard } from "~/components/site/equipment/equipment-wizard";

export const metadata: Metadata = {
  title: "Equipment",
  description: "Rent professional audio and event packages from ATMOS.",
};

export default function EquipmentPage() {
  return <EquipmentWizard />;
}
