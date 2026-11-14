import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContractBar } from "~/components/admin/contracts/contract-bar";
import { EquipmentHireAgreement } from "~/components/admin/contracts/equipment-hire-agreement";
import { hireFieldsSchema } from "~/lib/contracts";
import { requireAdmin } from "~/server/auth-session";
import { getHireContract } from "~/server/contracts";

type Param = string | string[] | undefined;
type Props = {
  searchParams: Promise<{ rental?: Param; contract?: Param; refresh?: Param }>;
};

const one = (param: Param) => (typeof param === "string" ? param : null);

/**
 * The contract the address names: `?rental=` (a `Rental` id) while that
 * row exists, `?contract=` (a saved contract's id) for one whose row has
 * gone, and neither for a blank contract, which is null here. `?refresh=1`
 * loads a saved draft with the database's current values.
 */
async function loadContract({ searchParams }: Props) {
  const admin = await requireAdmin();
  const { rental, contract, refresh } = await searchParams;
  const sourceId = one(rental);
  const contractId = one(contract);
  if (!sourceId && !contractId) return null;
  return (
    // Whoever generates the contract is its Atmos contact by default.
    (await getHireContract(
      sourceId,
      contractId,
      refresh === "1",
      admin.name,
    )) ?? notFound()
  );
}

/** The page title is the file name a browser offers when saving the PDF. */
export async function generateMetadata(props: Props): Promise<Metadata> {
  const view = await loadContract(props);
  const title = view
    ? `Equipment hire agreement - ${view.title}`
    : "Equipment hire agreement";
  return { title: { absolute: title } };
}

export default async function HireContractPage(props: Props) {
  const view = await loadContract(props);
  return (
    <>
      <ContractBar
        kind="HIRE"
        saved={
          view && {
            target: view.target,
            status: view.status,
            stale: view.stale,
          }
        }
      />
      <EquipmentHireAgreement
        fields={view?.fields ?? hireFieldsSchema.parse({})}
        locked={view?.status === "SENT" || view?.status === "SIGNED"}
        revision={view?.revision}
      />
    </>
  );
}
