"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Loader2, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import type { ContractStatus } from "~Prisma/browser";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  formatContractDate,
  hireFieldsSchema,
  performerFieldsSchema,
  type ContractSigning,
  type ContractTarget,
} from "~/lib/contracts";
import { readContractForm } from "~/components/admin/contracts/contract-form";
import { api } from "~/trpc/react";

const STATUS_LABELS = {
  DRAFT: "Draft",
  SENT: "Sent",
  SIGNED: "Signed",
} as const satisfies Record<ContractStatus, string>;

const isStatus = (value: string): value is ContractStatus =>
  value in STATUS_LABELS;

/** One line on where the contract has got to with its other party. */
function signingLine(status: ContractStatus, signing: ContractSigning) {
  if (status === "SIGNED" && signing.signedAt) {
    const on = formatContractDate(signing.signedAt);
    return signing.signedName
      ? `Signed online by ${signing.signedName} on ${on}.`
      : `Marked signed on ${on}.`;
  }
  if (status === "SENT" && signing.sentAt && signing.sentTo) {
    return `Sent to ${signing.sentTo} on ${formatContractDate(signing.sentAt)}. Waiting for their signature.`;
  }
  return null;
}

/**
 * The strip above a contract on screen: the way back, saving and its status,
 * sending it for signature, and the way to a PDF.
 *
 * `saved` is the contract's place in the database, or null for a blank one,
 * which can only be printed. Saving and sending both take the form as it
 * stands. A sent or signed contract is frozen, so for those only the status
 * is saved, and sending again is a reminder.
 */
export function ContractBar({
  kind,
  saved,
}: {
  kind: "PERFORMER" | "HIRE";
  saved: {
    target: ContractTarget;
    status: ContractStatus | null;
    stale: string[];
    signing: ContractSigning | null;
  } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<ContractStatus>(
    saved?.status ?? "DRAFT",
  );
  const locked = saved?.status === "SENT" || saved?.status === "SIGNED";

  /** This contract's own address: by its source while that exists, by its id once it does not. */
  const href = (target: ContractTarget, refresh = false) => {
    const source = kind === "PERFORMER" ? "set" : "rental";
    const query = target.sourceId
      ? `${source}=${target.sourceId}`
      : `contract=${target.contractId}`;
    return `${pathname}?${query}${refresh ? "&refresh=1" : ""}`;
  };

  const reload = (contractId: string) => {
    if (saved) router.replace(href({ ...saved.target, contractId }));
    router.refresh();
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const save = api.contracts.save.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Saved");
      reload(id);
    },
    onError,
  });
  const send = api.contracts.send.useMutation({
    onSuccess: ({ id, sentTo, reminder }) => {
      toast.success(`${reminder ? "Reminder sent" : "Sent"} to ${sentTo}`);
      setStatus("SENT");
      reload(id);
    },
    onError,
  });
  const busy = save.isPending || send.isPending;

  /** The contract and its form, as either mutation takes them. A frozen form is not sent. */
  function input() {
    if (!saved) return null;
    return kind === "PERFORMER"
      ? {
          kind,
          ...saved.target,
          fields: locked
            ? null
            : performerFieldsSchema.parse(readContractForm()),
        }
      : {
          kind,
          ...saved.target,
          fields: locked ? null : hireFieldsSchema.parse(readContractForm()),
        };
  }

  const line =
    saved?.status && saved.signing
      ? signingLine(saved.status, saved.signing)
      : null;
  const url = saved?.signing?.url;

  return (
    <div className="text-foreground mx-auto max-w-[210mm] space-y-2 px-4 py-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/contracts"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Contracts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {saved ? (
            <>
              <Select
                value={status}
                onValueChange={(value) => isStatus(value) && setStatus(value)}
              >
                <SelectTrigger size="sm" aria-label="Contract status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const contract = input();
                  if (contract) save.mutate({ ...contract, status });
                }}
              >
                {save.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Save
              </Button>
              {saved.status === "SIGNED" ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const contract = input();
                    if (contract) send.mutate(contract);
                  }}
                >
                  {send.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {saved.status === "SENT"
                    ? "Send a reminder"
                    : "Send for signature"}
                </Button>
              )}
            </>
          ) : null}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Print or save as PDF
          </Button>
        </div>
      </div>
      {line ? (
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-foreground">{line}</span>
          {url ? (
            <button
              type="button"
              className="hover:text-foreground inline-flex items-center gap-1 underline underline-offset-4"
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success("Signing link copied"))
              }
            >
              <Copy className="size-3.5" aria-hidden />
              Copy their link
            </button>
          ) : null}
        </p>
      ) : null}
      {locked ? (
        <p className="text-muted-foreground text-sm">
          A sent or signed contract is frozen. Set it back to Draft and save to
          edit it.
        </p>
      ) : saved && saved.stale.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          Changed in the database since this was saved:{" "}
          <span className="text-foreground">{saved.stale.join(", ")}</span>.{" "}
          <Link
            href={href(saved.target, true)}
            className="text-foreground underline underline-offset-4"
          >
            Use the current values
          </Link>
        </p>
      ) : null}
    </div>
  );
}
