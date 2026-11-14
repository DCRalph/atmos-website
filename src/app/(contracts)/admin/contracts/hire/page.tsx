import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EquipmentHireAgreement } from "~/components/admin/contracts/equipment-hire-agreement";
import { requireAdmin } from "~/server/auth-session";
import { getHireContract } from "~/server/contracts";

type Props = { searchParams: Promise<{ rental?: string | string[] }> };

/** The hire named by `?rental=` (a `Rental` id), or undefined for a blank contract. */
async function loadDetails({ searchParams }: Props) {
  await requireAdmin();
  const { rental } = await searchParams;
  if (typeof rental !== "string") return undefined;
  return (await getHireContract(rental)) ?? notFound();
}

/** The page title is the file name a browser offers when saving the PDF. */
export async function generateMetadata(props: Props): Promise<Metadata> {
  const details = await loadDetails(props);
  const title = details
    ? `Equipment hire agreement - ${details.name}`
    : "Equipment hire agreement";
  return { title: { absolute: title } };
}

export default async function HireContractPage(props: Props) {
  return <EquipmentHireAgreement details={await loadDetails(props)} />;
}
