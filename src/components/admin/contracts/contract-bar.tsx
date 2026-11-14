"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
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
  CONTRACT_FORM_ID,
  hireFieldsSchema,
  performerFieldsSchema,
  type ContractTarget,
} from "~/lib/contracts";
import { api } from "~/trpc/react";

const STATUS_LABELS = {
  DRAFT: "Draft",
  SENT: "Sent",
  SIGNED: "Signed",
} as const satisfies Record<ContractStatus, string>;

const isStatus = (value: string): value is ContractStatus =>
  value in STATUS_LABELS;

/**
 * The contract form as the object its schema expects: flat fields, with the
 * equipment list's `items.<row>.<column>` inputs gathered into rows.
 */
function readForm(): Record<string, unknown> {
  const form = document.getElementById(CONTRACT_FORM_ID);
  if (!(form instanceof HTMLFormElement)) return {};

  const fields: Record<string, string> = {};
  const items: Record<string, string>[] = [];
  for (const [name, value] of new FormData(form)) {
    if (typeof value !== "string") continue;
    const [list, row, column] = name.split(".");
    if (list === "items" && row && column) {
      (items[Number(row)] ??= {})[column] = value;
    } else {
      fields[name] = value;
    }
  }
  return { ...fields, items };
}

/**
 * The strip above a contract on screen: the way back, saving and its status,
 * and the way to a PDF.
 *
 * `saved` is the contract's place in the database, or null for a blank one,
 * which can only be printed. Saving sends the form as it stands. A sent or
 * signed contract is frozen, so for those only the status is sent.
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

  const save = api.contracts.save.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Saved");
      if (saved) router.replace(href({ ...saved.target, contractId: id }));
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  function onSave() {
    if (!saved) return;
    const base = { ...saved.target, status };
    if (kind === "PERFORMER") {
      save.mutate({
        kind,
        ...base,
        fields: locked ? null : performerFieldsSchema.parse(readForm()),
      });
    } else {
      save.mutate({
        kind,
        ...base,
        fields: locked ? null : hireFieldsSchema.parse(readForm()),
      });
    }
  }

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
                onClick={onSave}
                disabled={save.isPending}
              >
                {save.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Save
              </Button>
            </>
          ) : null}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden />
            Print or save as PDF
          </Button>
        </div>
      </div>
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
