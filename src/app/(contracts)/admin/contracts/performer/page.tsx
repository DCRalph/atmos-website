import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContractBar } from "~/components/admin/contracts/contract-bar";
import { PerformerAgreement } from "~/components/admin/contracts/performer-agreement";
import { performerFieldsSchema } from "~/lib/contracts";
import { requireAdmin } from "~/server/auth-session";
import { getPerformerContract } from "~/server/contracts";

type Param = string | string[] | undefined;
type Props = {
  searchParams: Promise<{ set?: Param; contract?: Param; refresh?: Param }>;
};

const one = (param: Param) => (typeof param === "string" ? param : null);

/**
 * The contract the address names: `?set=` (a `GigSetArtist` id) while that
 * row exists, `?contract=` (a saved contract's id) for one whose row has
 * gone, and neither for a blank contract, which is null here. `?refresh=1`
 * loads a saved draft with the database's current values.
 */
async function loadContract({ searchParams }: Props) {
  const admin = await requireAdmin();
  const { set, contract, refresh } = await searchParams;
  const sourceId = one(set);
  const contractId = one(contract);
  if (!sourceId && !contractId) return null;
  return (
    // Whoever generates the contract is its Atmos contact by default.
    (await getPerformerContract(
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
    ? `Performer agreement - ${view.title}`
    : "Performer agreement";
  return { title: { absolute: title } };
}

export default async function PerformerContractPage(props: Props) {
  const view = await loadContract(props);
  return (
    <>
      <ContractBar
        kind="PERFORMER"
        saved={
          view && {
            target: view.target,
            status: view.status,
            stale: view.stale,
          }
        }
      />
      <PerformerAgreement
        fields={view?.fields ?? performerFieldsSchema.parse({})}
        locked={view?.status === "SENT" || view?.status === "SIGNED"}
        revision={view?.revision}
      />
    </>
  );
}
