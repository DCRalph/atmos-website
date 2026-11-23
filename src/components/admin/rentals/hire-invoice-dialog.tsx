"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "~/components/confirm-provider";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { formatContractDate } from "~/lib/contracts";
import { hirePaymentState, type PaymentTone } from "~/lib/hire-invoices";
import { formatNZD } from "~/lib/ticketing/money";
import { paidWithLabel } from "~/lib/ticketing/payment-methods";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

type Rental = RouterOutputs["rentals"]["adminGetRentals"][number];

const TONES: Record<PaymentTone, string> = {
  ok: "border-green-500/50 text-green-500",
  warn: "border-amber-400/50 text-amber-400",
  bad: "border-red-500/50 text-red-500",
  mute: "text-muted-foreground",
};

const when = (date: Date) =>
  date.toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * The rentals table's Payment column: how far the rental has got towards
 * being paid. Once its agreement is signed, the badge opens the invoice:
 * what it is for, who it went to, and resend, void or issue it again.
 */
export function HirePaymentCell({ rental }: { rental: Rental }) {
  const [open, setOpen] = useState(false);
  const state = hirePaymentState(
    rental.contractStatus,
    rental.invoice,
    new Date(),
  );
  if (!state) return <span className="text-muted-foreground">—</span>;

  const badge = (
    <Badge variant="outline" className={TONES[state.tone]}>
      {state.label}
    </Badge>
  );
  if (rental.contractStatus !== "SIGNED") return badge;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Payment for ${rental.userName}: ${state.label}`}
        className="rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        {badge}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <InvoiceDetails rental={rental} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function InvoiceDetails({ rental }: { rental: Rental }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const refresh = () => utils.rentals.adminGetRentals.invalidate();
  const onError = (error: { message: string }) => toast.error(error.message);

  const issue = api.rentals.adminIssueHireInvoice.useMutation({
    onError: async (error) => {
      onError(error);
      await refresh();
    },
    onSuccess: async (outcome) => {
      toast.success(
        outcome === "paid"
          ? "It was paid in the meantime"
          : outcome === "issued"
            ? "Invoice issued and emailed"
            : "Already invoiced",
      );
      await refresh();
    },
  });
  const resend = api.rentals.adminResendHireInvoice.useMutation({
    onError,
    onSuccess: async ({ sentTo }) => {
      toast.success(`Invoice emailed to ${sentTo}`);
      await refresh();
    },
  });
  const voidInvoice = api.rentals.adminVoidHireInvoice.useMutation({
    onError,
    onSuccess: async () => {
      toast.success("Invoice voided");
      await refresh();
    },
  });

  const invoice = rental.invoice;
  const busy = issue.isPending || resend.isPending || voidInvoice.isPending;
  const issueButton = (
    <Button
      disabled={busy}
      onClick={() => issue.mutate({ rentalId: rental.id })}
    >
      {issue.isPending ? "Issuing…" : "Issue invoice"}
    </Button>
  );

  if (!invoice) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Not invoiced · {rental.userName}</DialogTitle>
          <DialogDescription>
            The hire agreement is signed, but no invoice went out. Issuing one
            bills the hire fee on the signed agreement and emails the hirer a
            link to pay it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">{issueButton}</div>
      </>
    );
  }

  const lines: [string, string, boolean?][] = [
    [invoice.description, formatNZD(invoice.totalCents)],
    ["Total", formatNZD(invoice.totalCents), true],
    ["Includes GST", formatNZD(invoice.gstCents)],
    ...(invoice.refundedCents > 0
      ? ([["Refunded", formatNZD(invoice.refundedCents)]] as [string, string][])
      : []),
  ];
  const history = [
    `Issued ${when(invoice.createdAt)}`,
    invoice.emailedAt &&
      `Emailed to ${invoice.emailedTo ?? "the hirer"}, ${when(invoice.emailedAt)}`,
    invoice.paidAt &&
      `Paid${invoice.paidWith ? ` with ${paidWithLabel(invoice.paidWith)}` : ""}, ${when(invoice.paidAt)}`,
  ].filter((line): line is string => Boolean(line));

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {invoice.number} · {rental.userName}
        </DialogTitle>
        <DialogDescription>
          Due {formatContractDate(invoice.dueAt)}.
        </DialogDescription>
      </DialogHeader>

      <dl className="text-sm">
        {lines.map(([label, value, strong]) => (
          <div
            key={label}
            className={cn(
              "flex justify-between gap-3 border-b py-1.5",
              strong ? "border-b-0 font-semibold" : "",
              label === "Includes GST" ? "text-muted-foreground" : "",
            )}
          >
            <dt>{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <ul className="text-muted-foreground space-y-1 text-xs">
        {history.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            void navigator.clipboard
              .writeText(invoice.payUrl)
              .then(() => toast.success("Pay link copied"))
          }
        >
          Copy pay link
        </Button>
        {invoice.status === "OPEN" ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => resend.mutate({ id: invoice.id })}
          >
            {resend.isPending ? "Sending…" : "Resend"}
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <a href={invoice.stripeUrl} target="_blank" rel="noreferrer">
            Open in Stripe
          </a>
        </Button>
        {invoice.status === "OPEN" ? (
          <Button
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: `Void ${invoice.number}`,
                description:
                  "The hirer will no longer be able to pay it. You can issue a new one afterwards.",
                confirmLabel: "Void",
                variant: "destructive",
              });
              if (ok) voidInvoice.mutate({ id: invoice.id });
            }}
          >
            Void
          </Button>
        ) : null}
        {invoice.status === "VOID" ? issueButton : null}
      </div>
    </>
  );
}
