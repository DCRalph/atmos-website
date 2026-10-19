"use client";

import { skipToken } from "@tanstack/react-query";

import { api } from "~/trpc/react";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { formatNZD } from "~/lib/ticketing/money";
import { paidWithLabel } from "~/lib/ticketing/payment-methods";
import { DetailRow, ExternalAnchor } from "~/components/admin/detail-row";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

/**
 * One donation, opened from a list: the donations counterpart of the order
 * dialog. Used by a gig's Donations tab and the Payments page. Closed while
 * `donationId` is null.
 */
export function DonationDialog({
  donationId,
  onClose,
}: {
  donationId: string | null;
  onClose: () => void;
}) {
  const donation = api.donations.donation.useQuery(
    donationId ? { id: donationId } : skipToken,
  );
  const receipt = api.donations.stripeReceiptUrl.useQuery(
    donationId && donation.data?.stripeChargeId ? { donationId } : skipToken,
  );
  const data = donation.data;

  return (
    <Dialog
      open={donationId !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Donation</DialogTitle>
          <DialogDescription>
            {data ? (
              <>
                {data.donorName ?? "No name"} · {data.donorEmail ?? "no email"}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-4">
            <dl className="space-y-1 text-sm">
              <DetailRow label="Amount" value={formatNZD(data.amountCents)} />
              {data.refundedCents > 0 && (
                <DetailRow
                  label="Refunded"
                  value={`${formatNZD(data.refundedCents)}${data.refundedAt ? ` · ${formatEventDateTime(data.refundedAt)}` : ""}`}
                />
              )}
              {data.paidWith && (
                <DetailRow
                  label="Paid with"
                  value={
                    <Badge variant="outline">
                      {paidWithLabel(data.paidWith)}
                    </Badge>
                  }
                />
              )}
              <DetailRow
                label="Paid"
                value={formatEventDateTime(data.paidAt)}
              />
              <DetailRow
                label="Stripe"
                value={
                  <span className="flex gap-3">
                    <ExternalAnchor href={data.stripeUrl}>
                      Payment
                    </ExternalAnchor>
                    {receipt.data && (
                      <ExternalAnchor href={receipt.data}>
                        Receipt
                      </ExternalAnchor>
                    )}
                  </span>
                }
              />
            </dl>
            <p className="text-muted-foreground border-t pt-4 text-xs">
              Refund donations in Stripe. The refund shows here once Stripe
              confirms it.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
