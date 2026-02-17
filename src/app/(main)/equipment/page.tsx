import { EquipmentCalendar } from "~/components/equipment/equipment-calendar";
import { orbitron } from "~/lib/fonts";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Equipment",
  description: "Rent professional audio and event gear from ATMOS.",
};

export default function EquipmentPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className={`text-4xl font-black tracking-tighter sm:text-6xl uppercase ${orbitron.className}`}>
          Equipment
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Professional gear for your next event. Check availability and request a booking below.
        </p>
      </div>

      <EquipmentCalendar />
    </div>
  );
}
