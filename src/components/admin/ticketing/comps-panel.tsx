"use client";

import { useMemo, useState } from "react";
import { Loader2, Mail, Minus, Plus, Send, Ticket } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  ACCESS_LEVELS,
  type AccessLevelValue,
  accessLevel as accessLevelMeta,
} from "~/lib/ticketing/access-levels";

type AdminEvent = RouterOutputs["ticketEvents"]["byId"];
type Comp = NonNullable<RouterOutputs["ticketAdmin"]["comps"]>[number];

/**
 * Comps — tickets given away by name.
 *
 * The shape this has to fit is an artist getting one AAA ticket plus a couple
 * of GA ones for whoever they're bringing, so a comp is a set of lines rather
 * than a quantity, and what each ticket gets past comes from the tier it's
 * drawn from. It all goes out as one order, so the recipient gets one email
 * with everything in it rather than three separate ones.
 */
export function CompsPanel({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [openCompId, setOpenCompId] = useState<string | null>(null);

  const comps = api.ticketAdmin.comps.useQuery({ eventId: event.id });
  const openComp = comps.data?.find((comp) => comp.id === openCompId);

  const compColumns: DataTableColumn<Comp>[] = [
    {
      id: "recipient",
      header: "Recipient",
      accessor: (row) => row.recipientName ?? "",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.recipientName ?? "No name"}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {row.recipientEmail ?? "no email"}
          </p>
        </div>
      ),
    },
    {
      id: "orderNumber",
      header: "Order",
      accessor: (row) => row.orderNumber,
      cell: (row) => (
        <span className="font-mono text-xs">{row.orderNumber}</span>
      ),
    },
    {
      id: "tickets",
      header: "Tickets",
      type: "number",
      align: "right",
      accessor: (row) => row.tickets.length,
    },
    {
      id: "createdAt",
      header: "Issued",
      type: "date",
      accessor: (row) => row.createdAt,
      cell: (row) =>
        new Date(row.createdAt).toLocaleDateString("en-NZ", {
          day: "numeric",
          month: "short",
        }),
    },
    {
      id: "notes",
      header: "Notes",
      cell: (row) => row.notes ?? "—",
    },
  ];

  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([tierId, quantity]) => ({ tierId, quantity })),
    [quantities],
  );

  const issue = api.ticketAdmin.issueComps.useMutation({
    onSuccess: (result) => {
      toast.success(
        sendEmail && recipientEmail
          ? `Sent ${result.ticketCount} ticket(s) to ${recipientEmail}.`
          : `Issued ${result.ticketCount} ticket(s) — order ${result.orderNumber}.`,
      );
      setRecipientName("");
      setRecipientEmail("");
      setNotes("");
      setQuantities({});
      void utils.ticketAdmin.comps.invalidate();
      void utils.ticketEvents.byId.invalidate();
      void utils.ticketAnalytics.overview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const canIssue =
    recipientName.trim().length > 0 &&
    ticketCount > 0 &&
    (!sendEmail || recipientEmail.trim().length > 0);

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-xl font-semibold">Give away tickets</h2>
          <p className="text-muted-foreground text-sm">
            One person, any mix of tiers. An artist might take an AAA for
            themselves and two general admissions for guests — that&apos;s one
            comp, one email.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Who&apos;s it for</Label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Name on the door"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email {sendEmail ? "" : "(optional)"}</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="them@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tickets</Label>
          {event.tiers.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Add a tier first — a comp still comes out of an allocation.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {event.tiers.map((tier) => {
                const quantity = quantities[tier.id] ?? 0;
                const remaining = Math.max(
                  0,
                  tier.allocation - tier.soldCount - tier.heldCount,
                );
                const meta = accessLevelMeta(tier.accessLevel);
                return (
                  <li key={tier.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{tier.name}</span>
                        <Badge variant="secondary">{meta.short}</Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {remaining} left of {tier.allocation}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`One fewer ${tier.name}`}
                        disabled={quantity === 0}
                        onClick={() =>
                          setQuantities((current) => ({
                            ...current,
                            [tier.id]: quantity - 1,
                          }))
                        }
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-8 text-center tabular-nums">
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`One more ${tier.name}`}
                        disabled={quantity >= Math.min(remaining, 20)}
                        onClick={() =>
                          setQuantities((current) => ({
                            ...current,
                            [tier.id]: quantity + 1,
                          }))
                        }
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why — kept on the order, never shown to them"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
          <span>
            Email the tickets straight away
            <span className="text-muted-foreground block text-xs">
              Off if you&apos;d rather hand them over another way — the link
              still works.
            </span>
          </span>
        </label>

        <Button
          disabled={!canIssue || issue.isPending}
          onClick={() =>
            issue.mutate({
              eventId: event.id,
              recipientName: recipientName.trim(),
              recipientEmail: recipientEmail.trim() || undefined,
              lines,
              notes: notes.trim() || undefined,
              sendEmail,
            })
          }
        >
          {issue.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Issuing…
            </>
          ) : (
            <>
              <Send className="size-4" />
              {ticketCount > 0
                ? `Comp ${ticketCount} ticket${ticketCount === 1 ? "" : "s"}`
                : "Comp tickets"}
            </>
          )}
        </Button>
      </section>

      <section className="space-y-3">
        <DataTable
          title="Comps issued"
          columns={compColumns}
          data={comps.data ?? []}
          getRowId={(row) => row.id}
          isLoading={comps.isPending}
          isFetching={comps.isFetching}
          onRowClick={(row) => setOpenCompId(row.id)}
          storageKey="admin-ticket-comps"
          emptyMessage="Nothing comped for this event yet."
        />
      </section>

      {/* The tickets in a comp, where an artist's own ticket gets set apart
          from their guests'. */}
      <Dialog
        open={openCompId !== null}
        onOpenChange={(open) => !open && setOpenCompId(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{openComp?.recipientName ?? "Comp"}</DialogTitle>
            <DialogDescription>
              {openComp?.orderNumber}
              {openComp?.notes ? ` · ${openComp.notes}` : ""}
            </DialogDescription>
          </DialogHeader>
          {openComp && <CompTickets comp={openComp} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompTickets({ comp }: { comp: Comp }) {
  const utils = api.useUtils();

  const setLevel = api.ticketAdmin.setTicketAccessLevel.useMutation({
    onSuccess: () => {
      toast.success("Ticket updated");
      void utils.ticketAdmin.comps.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3">
      <a
        href={comp.ticketsUrl}
        target="_blank"
        rel="noreferrer"
        className="text-muted-foreground inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
      >
        <Ticket className="size-3.5" aria-hidden />
        Their tickets
      </a>

      <ul className="space-y-2">
        {comp.tickets.map((ticket) => (
          <li
            key={ticket.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm"
          >
            <span className="min-w-0">
              <span className="font-mono text-xs">{ticket.ticketNumber}</span>
              <span className="text-muted-foreground ml-2">
                {ticket.tierName}
                {ticket.attendeeName ? ` · ${ticket.attendeeName}` : ""}
              </span>
            </span>

            {/* Per-ticket, because the point of a comp is that one of them is
                the artist and the rest are their guests. */}
            <select
              value={ticket.accessLevel}
              disabled={setLevel.isPending}
              onChange={(e) =>
                setLevel.mutate({
                  ticketId: ticket.id,
                  accessLevel: e.target.value as AccessLevelValue,
                })
              }
              aria-label={`Access level for ${ticket.ticketNumber}`}
              className="border-input bg-background h-8 rounded-md border px-2 text-xs"
            >
              {ACCESS_LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      {!comp.recipientEmail && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Mail className="size-3.5" aria-hidden />
          No email on this one — send them the link above.
        </p>
      )}
    </div>
  );
}
