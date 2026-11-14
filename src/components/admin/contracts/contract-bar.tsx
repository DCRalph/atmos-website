"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "~/components/ui/button";

/** The strip above a contract on screen: the way back, and the way to a PDF. */
export function ContractBar() {
  return (
    <div className="text-foreground mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3 print:hidden">
      <Link
        href="/admin/contracts"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Contracts
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground hidden text-sm sm:inline">
          Every field can be edited.
        </span>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Print or save as PDF
        </Button>
      </div>
    </div>
  );
}
