"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { AccessLevelSelect } from "~/components/admin/ticketing/access-level-select";
import { useAccessLevels } from "~/hooks/use-access-levels";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { Choice, DiffList, Field, Loading, shown, type DiffRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "find", label: "Find the order" },
  { key: "what", label: "What to change" },
  { key: "change", label: "Change it" },
  { key: "review", label: "Review" },
] as const;

type Kind = "buyer" | "names" | "access";

const KINDS: { kind: Kind; title: string; detail: string }[] = [
  {
    kind: "buyer",
    title: "Their name, email or phone",
    detail: "Where the tickets go, and who to call. The most common fix.",
  },
  {
    kind: "names",
    title: "Who each ticket is for",
    detail: "The name the door sees when a ticket is scanned.",
  },
  {
    kind: "access",
    title: "What a ticket gets past",
    detail:
      "Upgrade or change one ticket's access. The QR code stays the same.",
  },
];

type FoundOrder = RouterOutputs["ticketAdmin"]["orders"]["orders"][number];
type Order = RouterOutputs["ticketAdmin"]["order"];
type Buyer = { name: string; email: string; phone: string };

/** A loose check, so Next stays off until it looks like an address. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS: Record<FoundOrder["status"], string> = {
  PENDING: "Checking out",
  PAID: "Paid",
  FAILED: "Failed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Part refunded",
  AWAITING_APPROVAL: "Waiting for approval",
};

const orderHref = (order: { id: string; eventId: string }) =>
  `/admin/events/${order.eventId}?section=orders&order=${order.id}`;

const buyerOf = (order: Order): Buyer => ({
  name: order.buyerName ?? "",
  email: order.buyerEmail ?? "",
  phone: order.buyerPhone ?? "",
});

/**
 * Change a buyer's ticket: find their order, then fix their details, the
 * names on the tickets, or what a ticket gets past. Refunds, voids and
 * resends stay on the order itself, where the money is shown beside them.
 */
export function ChangeTicketWizard() {
  const eventId = useSearchParams().get("event");
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const { level } = useAccessLevels();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("buyer");
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [access, setAccess] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const order = api.ticketAdmin.order.useQuery(
    { id: orderId ?? "" },
    { enabled: Boolean(orderId) },
  );

  const updateBuyer = api.ticketAdmin.updateBuyer.useMutation();
  const setTicketName = api.ticketAdmin.setTicketName.useMutation();
  const setTicketAccessLevel =
    api.ticketAdmin.setTicketAccessLevel.useMutation();

  const pick = (id: string) => {
    setOrderId(id);
    setBuyer(null);
    setNames({});
    setAccess({});
    steps.next();
  };

  const data = order.data;
  // Voided and refunded tickets can't get anyone in, so there is nothing to
  // change on them.
  const tickets = data?.tickets.filter((ticket) => ticket.status === "VALID");
  const savedBuyer = data ? buyerOf(data) : null;
  const shownBuyer = buyer ?? savedBuyer;

  const rows: DiffRow[] = [];
  if (savedBuyer && buyer) {
    const fields: { label: string; key: keyof Buyer }[] = [
      { label: "Buyer name", key: "name" },
      { label: "Email", key: "email" },
      { label: "Phone", key: "phone" },
    ];
    for (const field of fields) {
      if (buyer[field.key].trim() !== savedBuyer[field.key]) {
        rows.push({
          label: field.label,
          before: shown(savedBuyer[field.key]),
          after: shown(buyer[field.key]),
        });
      }
    }
  }
  for (const ticket of tickets ?? []) {
    const name = names[ticket.id];
    if (name !== undefined && name.trim() !== (ticket.attendeeName ?? "")) {
      rows.push({
        label: `${ticket.ticketNumber} name`,
        before: shown(ticket.attendeeName),
        after: shown(name),
      });
    }
    const code = access[ticket.id];
    if (code !== undefined && code !== ticket.accessLevel) {
      rows.push({
        label: `${ticket.ticketNumber} access`,
        before: ticket.level.label,
        after: level(code).label,
      });
    }
  }

  const emailError =
    buyer && buyer.email.trim() !== savedBuyer?.email
      ? !EMAIL.test(buyer.email.trim())
        ? "That doesn't look like an email address."
        : null
      : null;

  const save = async () => {
    if (!data || !savedBuyer) return;
    setIsSaving(true);
    try {
      if (buyer) {
        const changed = {
          buyerName:
            buyer.name.trim() !== savedBuyer.name
              ? buyer.name.trim()
              : undefined,
          buyerEmail:
            buyer.email.trim() !== savedBuyer.email
              ? buyer.email.trim()
              : undefined,
          buyerPhone:
            buyer.phone.trim() !== savedBuyer.phone
              ? buyer.phone.trim()
              : undefined,
        };
        if (Object.values(changed).some((value) => value !== undefined)) {
          await updateBuyer.mutateAsync({ orderId: data.id, ...changed });
        }
      }
      for (const ticket of tickets ?? []) {
        const name = names[ticket.id]?.trim();
        if (name !== undefined && name !== (ticket.attendeeName ?? "")) {
          await setTicketName.mutateAsync({
            ticketId: ticket.id,
            attendeeName: name,
          });
        }
        const code = access[ticket.id];
        if (code !== undefined && code !== ticket.accessLevel) {
          await setTicketAccessLevel.mutateAsync({
            ticketId: ticket.id,
            accessLevel: code,
          });
        }
      }
      setIsDone(true);
      toast.success("Order updated");
      await Promise.all([
        utils.ticketAdmin.order.invalidate({ id: data.id }),
        utils.ticketAdmin.orders.invalidate(),
      ]);
    } catch (error) {
      // Earlier calls in the run may have landed, so reload to show them.
      toast.error(error instanceof Error ? error.message : "Could not save");
      await utils.ticketAdmin.order.invalidate({ id: data.id });
    } finally {
      setIsSaving(false);
    }
  };

  const subtitle = data
    ? `${data.buyerName ?? data.buyerEmail ?? "No name"} · ${data.orderNumber} · ${data.event.name}`
    : undefined;

  return (
    <WizardShell
      wizard="change-ticket"
      subtitle={subtitle}
      editorHref={data ? orderHref(data) : undefined}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        isDone && data ? (
          <DonePanel
            title="Order updated"
            description="The door and the buyer's ticket page show the change straight away. Nothing was emailed."
            links={[{ href: orderHref(data), label: "Open the order" }]}
          />
        ) : undefined
      }
    >
      {steps.step === "find" ? (
        <FindOrder eventId={eventId} onPick={pick} />
      ) : null}

      {steps.step !== "find" && orderId && !data ? (
        order.isPending ? (
          <Loading />
        ) : (
          <p className="text-sm">That order is gone.</p>
        )
      ) : null}

      {steps.step === "what" && data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What needs changing?</CardTitle>
              <CardDescription>
                {data.tickets.length} ticket
                {data.tickets.length === 1 ? "" : "s"} · {STATUS[data.status]}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                {KINDS.map((option) => (
                  <Choice
                    key={option.kind}
                    selected={kind === option.kind}
                    onSelect={() => setKind(option.kind)}
                    title={option.title}
                    detail={option.detail}
                  />
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                To refund, void or resend,{" "}
                <Link
                  href={orderHref(data)}
                  className="text-foreground underline underline-offset-4"
                >
                  open the order
                </Link>
                .
              </p>
            </CardContent>
          </Card>
          <WizardFooter onBack={steps.back} onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "change" && data && shownBuyer ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {KINDS.find((option) => option.kind === kind)?.title}
              </CardTitle>
              <CardDescription>
                {kind === "buyer"
                  ? "Saving doesn't email them. Resend from the order if they need the tickets again."
                  : kind === "names"
                    ? "A name set here is locked, so the buyer can't change it back."
                    : "The door reads the new access on the next scan."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kind === "buyer" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="buyer-name" label="Name">
                    <Input
                      id="buyer-name"
                      value={shownBuyer.name}
                      maxLength={120}
                      onChange={(e) =>
                        setBuyer({ ...shownBuyer, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    id="buyer-email"
                    label="Email"
                    error={emailError ?? undefined}
                  >
                    <Input
                      id="buyer-email"
                      type="email"
                      value={shownBuyer.email}
                      onChange={(e) =>
                        setBuyer({ ...shownBuyer, email: e.target.value })
                      }
                    />
                  </Field>
                  <Field id="buyer-phone" label="Phone">
                    <Input
                      id="buyer-phone"
                      value={shownBuyer.phone}
                      maxLength={40}
                      onChange={(e) =>
                        setBuyer({ ...shownBuyer, phone: e.target.value })
                      }
                    />
                  </Field>
                </div>
              ) : !tickets || tickets.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  This order has no live tickets.
                </p>
              ) : (
                <ul className="divide-border divide-y rounded-lg border">
                  {tickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-xs">
                          {ticket.ticketNumber}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {ticket.tier?.name ?? "Comp"} · {ticket.level.label}
                        </span>
                      </span>
                      {kind === "names" ? (
                        <Input
                          aria-label={`Name on ${ticket.ticketNumber}`}
                          placeholder="Nobody yet"
                          maxLength={120}
                          value={names[ticket.id] ?? ticket.attendeeName ?? ""}
                          onChange={(e) =>
                            setNames((all) => ({
                              ...all,
                              [ticket.id]: e.target.value,
                            }))
                          }
                          className="h-8 w-full sm:w-64"
                        />
                      ) : (
                        <AccessLevelSelect
                          value={access[ticket.id] ?? ticket.accessLevel}
                          onValueChange={(code) =>
                            setAccess((all) => ({ ...all, [ticket.id]: code }))
                          }
                          size="sm"
                          className="w-full sm:w-56"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={Boolean(emailError)}
            hint={emailError ?? undefined}
          />
        </>
      ) : null}

      {steps.step === "review" && data ? (
        <>
          <DiffList rows={rows} empty="No changes yet. Go back to make some." />
          <WizardFooter
            onBack={steps.back}
            label={`Save ${rows.length} change${rows.length === 1 ? "" : "s"}`}
            onNext={() => void save()}
            disabled={rows.length === 0 || Boolean(emailError)}
            isPending={isSaving}
          />
        </>
      ) : null}
    </WizardShell>
  );
}

/**
 * Search orders by buyer name, email or order number, newest first. Narrowed
 * to one event when the wizard was opened from it.
 */
function FindOrder({
  eventId,
  onPick,
}: {
  eventId: string | null;
  onPick: (orderId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const orders = api.ticketAdmin.orders.useQuery(
    { search: search || undefined, eventId: eventId ?? undefined, limit: 20 },
    { placeholderData: (previous) => previous },
  );
  const list = orders.data?.orders ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whose order?</CardTitle>
        <CardDescription>
          Search by the buyer&apos;s name, email or order number.
          {eventId ? " Only this event's orders are shown." : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email or order number"
            className="pl-9"
            aria-label="Search orders"
            autoFocus
          />
        </div>
        {orders.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading...
          </div>
        ) : list.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {search ? "No orders match." : "No orders yet."}
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {list.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onPick(order.id)}
                  className="hover:bg-secondary/60 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {order.buyerName ?? order.buyerEmail ?? "No name"}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {[
                        order.buyerName ? order.buyerEmail : null,
                        order.orderNumber,
                        order.event.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
                    {order._count.tickets} ticket
                    {order._count.tickets === 1 ? "" : "s"} ·{" "}
                    {STATUS[order.status]}
                  </span>
                  <ChevronRight
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
