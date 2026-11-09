"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { StatTile } from "~/components/admin/ticketing/charts";
import { useConfirm } from "~/components/confirm-provider";
import { Button } from "~/components/ui/button";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { MailoutPreview } from "./mailout-preview";

type Mailout = RouterOutputs["mailouts"]["get"];

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-NZ", { style: "currency", currency: "NZD" });

const share = (part: number, whole: number) =>
  whole ? `${Math.round((part / whole) * 100)}%` : undefined;

/**
 * A mailout once it is scheduled or has gone: where it is up to, what
 * happened to it, and what it sold.
 */
export function MailoutResults({ mailout }: { mailout: Mailout }) {
  const router = useRouter();
  const confirm = useConfirm();
  const utils = api.useUtils();
  const lists = api.mailingLists.list.useQuery();
  const problems = api.mailouts.problems.useQuery({ id: mailout.id });
  const { results } = mailout;

  const refresh = () => {
    void utils.mailouts.get.invalidate({ id: mailout.id });
    void utils.mailouts.problems.invalidate({ id: mailout.id });
    void utils.mailouts.list.invalidate();
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const cancel = api.mailouts.cancel.useMutation({
    onSuccess: refresh,
    onError,
  });
  const unschedule = api.mailouts.unschedule.useMutation({
    onSuccess: refresh,
    onError,
  });
  const retry = api.mailouts.retryFailed.useMutation({
    onSuccess: ({ requeued }) => {
      toast.success(`Retrying ${requeued}`);
      refresh();
    },
    onError,
  });
  const duplicate = api.mailouts.duplicate.useMutation({
    onSuccess: ({ id }) => {
      void utils.mailouts.list.invalidate();
      router.push(`/admin/mailouts/${id}`);
    },
    onError,
  });

  const listNames = mailout.listIds
    .map((id) => lists.data?.find((list) => list.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const total =
    results.queued + results.sent + results.failed + results.skipped;

  const status =
    mailout.status === "SCHEDULED" && mailout.scheduledFor
      ? `Scheduled for ${formatEventDateTime(mailout.scheduledFor)}`
      : mailout.status === "SENDING"
        ? `Sending: ${results.sent.toLocaleString()} of ${total.toLocaleString()} so far`
        : mailout.status === "CANCELLED"
          ? `Cancelled${mailout.cancelledAt ? ` ${formatEventDateTime(mailout.cancelledAt)}` : ""}`
          : `Sent${mailout.finishedAt ? ` ${formatEventDateTime(mailout.finishedAt)}` : ""}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="font-medium">{status}</p>
          <p className="text-muted-foreground text-sm">To {listNames}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {mailout.status === "SCHEDULED" && (
            <Button
              variant="outline"
              disabled={unschedule.isPending}
              onClick={() => unschedule.mutate({ id: mailout.id })}
            >
              Unschedule and edit
            </Button>
          )}
          {(mailout.status === "SCHEDULED" || mailout.status === "SENDING") && (
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Cancel this mailout?",
                  description:
                    mailout.status === "SENDING"
                      ? "Nobody else gets it. Whoever already has it keeps it."
                      : "It will not go out.",
                  confirmLabel: "Cancel mailout",
                  cancelLabel: "Keep it",
                  variant: "destructive",
                });
                if (ok) cancel.mutate({ id: mailout.id });
              }}
            >
              Cancel mailout
            </Button>
          )}
          {results.failed > 0 && mailout.status !== "CANCELLED" && (
            <Button
              variant="outline"
              disabled={retry.isPending}
              onClick={() => retry.mutate({ id: mailout.id })}
            >
              Retry {results.failed} failed
            </Button>
          )}
          <Button
            variant="outline"
            disabled={duplicate.isPending}
            onClick={() => duplicate.mutate({ id: mailout.id })}
          >
            Duplicate
          </Button>
        </div>

        {mailout.status !== "SCHEDULED" && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Sent" value={results.sent.toLocaleString()} />
              <StatTile
                label="Delivered"
                value={results.delivered.toLocaleString()}
                sub={share(results.delivered, results.sent)}
              />
              <StatTile
                label="Clicked"
                value={results.clicked.toLocaleString()}
                sub={share(results.clicked, results.delivered)}
              />
              <StatTile
                label="Ticket sales"
                value={money(results.revenueCents)}
                sub={`${results.orders} order${results.orders === 1 ? "" : "s"}`}
              />
              <StatTile
                label="Unsubscribed"
                value={results.unsubscribed.toLocaleString()}
                sub={share(results.unsubscribed, results.sent)}
              />
              <StatTile
                label="Bounced"
                value={results.bounced.toLocaleString()}
              />
              <StatTile
                label="Spam reports"
                value={results.complained.toLocaleString()}
                tone={results.complained ? "loss" : undefined}
              />
              <StatTile
                label="Not sent"
                value={(results.failed + results.skipped).toLocaleString()}
                sub={
                  results.queued
                    ? `${results.queued.toLocaleString()} still queued`
                    : undefined
                }
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Delivered, bounced and spam reports come from Resend as they
              happen. Clicks only count if click tracking is on for the sending
              domain. Ticket sales are orders that arrived through this
              mailout&apos;s links.
            </p>
          </>
        )}

        {problems.data && problems.data.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Did not arrive
            </h3>
            <ul className="divide-y text-sm">
              {problems.data.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap justify-between gap-x-4 py-2"
                >
                  <span className="break-all">{row.email}</span>
                  <span className="text-muted-foreground">
                    {row.complainedAt
                      ? "Marked as spam"
                      : row.bouncedAt
                        ? "Bounced"
                        : (row.error ?? "Failed")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <MailoutPreview
          html={mailout.html}
          draft={
            mailout.html
              ? undefined
              : {
                  subject: mailout.subject,
                  previewText: mailout.previewText,
                  heading: mailout.heading,
                  body: mailout.body,
                  imageFileId: mailout.imageFileId,
                  buttonLabel: mailout.buttonLabel,
                  buttonUrl: mailout.buttonUrl,
                  slug: mailout.slug,
                  listNames: listNames ? listNames.split(", ") : [],
                }
          }
        />
      </div>
    </div>
  );
}
