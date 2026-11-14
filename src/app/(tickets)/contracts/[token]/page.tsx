import "~/styles/contract.css";

import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EquipmentHireAgreement } from "~/components/admin/contracts/equipment-hire-agreement";
import { PerformerAgreement } from "~/components/admin/contracts/performer-agreement";
import {
  PrintButton,
  SignPanel,
} from "~/components/admin/contracts/sign-panel";
import { formatContractDate, SIGNER_FIELDS } from "~/lib/contracts";
import { getSigningView } from "~/server/contract-signing";

type Props = { params: Promise<{ token: string }> };

/** Shared by the page and its metadata. */
const loadView = cache(async (token: string) => getSigningView(token));

/** The page title is the file name a browser offers when saving the PDF. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await loadView((await params).token);
  return {
    title: { absolute: view ? `Atmos agreement - ${view.title}` : "Atmos" },
    robots: { index: false, follow: false },
  };
}

/**
 * Where a contract's other party reads and signs it, from the link in their
 * email. The token in the address is the credential: there is no sign-in.
 *
 * A sent contract shows with their own fields open to fill in and the sign
 * panel under it. A signed one is their copy, to print or save. A contract
 * taken back to a draft is being changed, so it shows nothing until it is
 * sent again.
 */
export default async function ContractSigningPage({ params }: Props) {
  const { token } = await params;
  const view = (await loadView(token)) ?? notFound();
  const { status, signing } = view;

  const heading =
    status === "SIGNED"
      ? "Signed"
      : status === "SENT"
        ? "Read and sign"
        : "Being updated";
  const lead =
    status === "SIGNED"
      ? `${signing.signedName ? `Signed by ${signing.signedName}` : "Signed"}${signing.signedAt ? ` on ${formatContractDate(signing.signedAt)}` : ""}. This is your copy.`
      : status === "SENT"
        ? "Read the agreement, fill in the highlighted details, then sign at the bottom."
        : "Atmos is changing this agreement. You will get an email when it is ready to sign.";

  // Only a sent contract opens the signer's own fields; signed is frozen.
  const sheet = {
    locked: status === "SIGNED",
    revision: status,
    signing,
    signerFields: status === "SENT" ? SIGNER_FIELDS[view.kind] : undefined,
  };

  return (
    <main className="pb-16 print:pb-0">
      <div className="mx-auto max-w-[210mm] px-4 pt-8 pb-6 print:hidden">
        <h1 className="t-heading text-[clamp(2rem,9vw,3rem)]">{heading}</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
          {lead}
        </p>
        {status === "SIGNED" ? (
          <div className="mt-6">
            <PrintButton />
          </div>
        ) : null}
      </div>
      {status === "DRAFT" ? null : view.kind === "PERFORMER" ? (
        <PerformerAgreement fields={view.fields} {...sheet} />
      ) : (
        <EquipmentHireAgreement fields={view.fields} {...sheet} />
      )}
      {status === "SENT" ? <SignPanel token={token} kind={view.kind} /> : null}
    </main>
  );
}
