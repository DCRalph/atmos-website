"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Loader2, Save, Undo2 } from "lucide-react";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { SaveStatusPill } from "~/components/admin/save-status";
import { EventStatusBadge } from "~/components/admin/ticketing/ticket-events-table";
import { OrdersPanel } from "~/components/admin/ticketing/orders-panel";
import { TicketsPanel } from "~/components/admin/ticketing/tickets-panel";
import { CompsPanel } from "~/components/admin/ticketing/comps-panel";
import { TicketLinksPanel } from "~/components/admin/ticketing/ticket-links-panel";
import { EventCodesPanel } from "~/components/admin/ticketing/event-codes-panel";
import { Button } from "~/components/ui/button";
import { useTabParam } from "~/hooks/use-tab-param";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { cn } from "~/lib/utils";
import { buildChecklist, type AdminEvent, type Section } from "./draft";
import { useEventDraft } from "./use-event-draft";
import { DetailsSection } from "./details-section";
import { TiersSection } from "./tiers-section";
import { CostsSection } from "./costs-section";
import { StaffSection } from "./staff-section";
import { WalletSection } from "./wallet-section";
import { OverviewSection } from "./overview-section";
import { EventMenu } from "./event-menu";

/**
 * The event page: one draft, one Save, a sidebar grouped by what you're
 * doing. Set up is the draft (details, tiers, costs, door staff, wallet
 * pass). Sell and Give away are live lists, because refunding or issuing a
 * ticket is a real-world action with an email or a Stripe call behind it, not
 * a draft.
 *
 * A new event uses the same page with only the Set up group; creating it
 * lands on its Overview.
 */

const PAGES = [
  "overview",
  "details",
  "tiers",
  "costs",
  "staff",
  "wallet",
  "orders",
  "tickets",
  "codes",
  "comps",
  "links",
] as const;
type Page = (typeof PAGES)[number];

const NEW_PAGES = ["details", "tiers", "costs", "staff", "wallet"] as const;

export function EventWorkspace({ event }: { event?: AdminEvent }) {
  const state = useEventDraft(event);
  const { draft, dirty, isDirty, isSaving, status, errorMessage } = state;

  const nav = useTabParam(event ? PAGES : NEW_PAGES, "section");
  const page: Page = nav.value;
  const open = (next: Section | Page) => nav.onValueChange(next);

  // The linked gig's poster, the fallback when none is uploaded.
  const linkedGig = api.gigs.getForEditor.useQuery(
    { id: draft.gigId ?? "" },
    { enabled: draft.gigId !== null },
  );
  const gigPosterId = linkedGig.data?.posterFileUploadId ?? null;

  const checklist = useMemo(
    () => buildChecklist({ draft, event, gigPosterId, isDirty }),
    [draft, event, gigPosterId, isDirty],
  );

  const save = async () => {
    const failedIn = await state.save();
    if (failedIn) open(failedIn);
  };

  const SECTION_LABEL: Record<Section, string> = {
    details: "Details",
    tiers: "Tiers",
    costs: "Costs",
    staff: "Door staff",
    wallet: "Wallet pass",
  };

  const groups: {
    label: string;
    items: { page: Page; label: string; count?: number; dirty?: boolean }[];
  }[] = [
    {
      label: "Set up",
      items: [
        { page: "details", label: "Details", dirty: dirty.includes("details") },
        {
          page: "tiers",
          label: "Tiers",
          count: draft.tiers.length,
          dirty: dirty.includes("tiers"),
        },
        {
          page: "costs",
          label: "Costs",
          count: draft.costs.length + (draft.venueHire.trim() ? 1 : 0),
          dirty: dirty.includes("costs"),
        },
        {
          page: "staff",
          label: "Door staff",
          count: draft.staff.length,
          dirty: dirty.includes("staff"),
        },
        {
          page: "wallet",
          label: "Wallet pass",
          dirty: dirty.includes("wallet"),
        },
      ],
    },
    ...(event
      ? [
          {
            label: "Sell",
            items: [
              { page: "overview" as const, label: "Overview" },
              {
                page: "orders" as const,
                label: "Orders",
                count: event.counts.orders,
              },
              {
                page: "tickets" as const,
                label: "Tickets",
                count: event.counts.tickets,
              },
              { page: "codes" as const, label: "Codes" },
            ],
          },
          {
            label: "Give away",
            items: [
              {
                page: "comps" as const,
                label: "Comps",
                count: event.counts.comps,
              },
              {
                page: "links" as const,
                label: "Ticket links",
                count: event.counts.linkBatches,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <AdminSection
      title={event ? event.name : "New ticketed event"}
      subtitle={
        event
          ? `${formatEventDateTime(event.startsAt, event.timezone)}${event.venueName ? ` · ${event.venueName}` : ""}`
          : undefined
      }
      backLink={{ href: "/admin/events", label: "Events" }}
      actions={
        event ? (
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            {event.status === "PUBLISHED" ||
            event.status === "SALES_PAUSED" ||
            event.status === "SOLD_OUT" ? (
              <Button asChild>
                <Link href={`/admin/events/${event.id}/live`}>Live door</Link>
              </Button>
            ) : null}
            <EventMenu event={event} />
          </div>
        ) : undefined
      }
    >
      {/* The page's one and only Save, above every section. */}
      <div className="bg-background/95 sticky top-20 z-20 -mx-2 mb-6 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 backdrop-blur">
        <SaveStatusPill status={status} errorMessage={errorMessage} />
        <span className="text-muted-foreground text-sm">
          {status === "dirty"
            ? `Unsaved: ${dirty.map((s) => SECTION_LABEL[s]).join(", ")}. Cmd+S saves every section at once.`
            : status === "idle"
              ? event
                ? "Everything here is up to date."
                : "Fill in the details, then create the event."
              : null}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {isDirty && event ? (
            <Button variant="ghost" disabled={isSaving} onClick={state.discard}>
              <Undo2 className="size-4" /> Discard
            </Button>
          ) : null}
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="size-4" /> {event ? "Save" : "Create event"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav
          aria-label="Event sections"
          className="flex flex-row flex-wrap gap-1 lg:sticky lg:top-40 lg:flex-col lg:self-start"
        >
          {groups.map((group) => (
            <div key={group.label} className="contents lg:block">
              <p className="text-muted-foreground hidden px-2.5 pt-3 pb-1 text-[10.5px] font-medium tracking-[0.08em] uppercase first:pt-0 lg:block">
                {group.label}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => open(item.page)}
                  aria-current={page === item.page ? "page" : undefined}
                  className={cn(
                    "text-muted-foreground hover:text-foreground flex w-auto items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm lg:w-full",
                    page === item.page && "bg-muted text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {item.label}
                    {item.dirty ? (
                      <span
                        className="size-1.5 rounded-full bg-amber-500"
                        aria-label="Unsaved changes"
                      />
                    ) : null}
                  </span>
                  {item.count !== undefined ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          {page === "overview" && event ? (
            <OverviewSection
              event={event}
              checklist={checklist}
              onOpenSection={open}
            />
          ) : null}
          {page === "details" ? (
            <DetailsSection
              state={state}
              event={event}
              gigPosterId={gigPosterId}
            />
          ) : null}
          {page === "tiers" ? (
            <TiersSection state={state} event={event} />
          ) : null}
          {page === "costs" ? (
            <CostsSection state={state} event={event} />
          ) : null}
          {page === "staff" ? (
            <StaffSection state={state} eventId={event?.id} />
          ) : null}
          {page === "wallet" ? <WalletSection state={state} /> : null}
          {page === "orders" && event ? (
            <OrdersPanel eventId={event.id} />
          ) : null}
          {page === "tickets" && event ? (
            <TicketsPanel eventId={event.id} />
          ) : null}
          {page === "codes" && event ? <EventCodesPanel event={event} /> : null}
          {page === "comps" && event ? <CompsPanel event={event} /> : null}
          {page === "links" && event ? (
            <TicketLinksPanel event={event} />
          ) : null}
        </div>
      </div>
    </AdminSection>
  );
}
