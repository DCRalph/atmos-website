import "~/styles/contract.css";

import type { Metadata } from "next";

import { ContractBar } from "~/components/admin/contracts/contract-bar";
import { siteFontVariables } from "~/lib/site-fonts";
import { cn } from "~/lib/utils";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * A contract on its own, outside the admin shell, so that printing the page
 * prints the contract and nothing else. Admins only: each page checks.
 */
export default function ContractsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "dark min-h-dvh bg-black pb-12 print:bg-transparent print:pb-0",
        siteFontVariables,
      )}
    >
      <ContractBar />
      {children}
    </div>
  );
}
