"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BadgePercent,
  BellRing,
  ClipboardList,
  FileText,
  Gift,
  LayoutDashboard,
  Layers,
  Link2,
  Megaphone,
  Receipt,
  ShoppingCart,
  TicketCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { api } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { SaveBar } from "~/components/admin/save-status";
import { EventStatusBadge } from "~/components/admin/ticketing/ticket-events-table";
import { OrdersPanel } from "~/components/admin/ticketing/orders-panel";
import { TicketsPanel } from "~/components/admin/ticketing/tickets-panel";
import { CompsPanel } from "~/components/admin/ticketing/comps-panel";
import { TicketLinksPanel } from "~/components/admin/ticketing/ticket-links-panel";
import { EventCodesPanel } from "~/components/admin/ticketing/event-codes-panel";
import { CampaignsPanel } from "~/components/admin/ticketing/campaigns-panel";
import { SalesAlertsPanel } from "~/components/admin/ticketing/sales-alerts-panel";
import { EventSummary } from "~/components/admin/ticketing/event-summary";
import {
  SectionNav,
  type SectionNavGroup,
} from "~/components/admin/section-nav/section-nav";
import { Button } from "~/components/ui/button";
import { useTabParam } from "~/hooks/use-tab-param";
import { formatEventDateTime } from "~/lib/ticketing/dates";
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
 * The event page: one draft, one Save, a section rail grouped by what you're
 * doing. Overview comes first, then Summary, the after-the-night recap. Set up is the draft (details, tiers, costs,
 * door staff, wallet pass). Sell and Give away are live lists, because
 * refunding or issuing a ticket is a real-world action with an email or a
 * Stripe call behind it, not a draft. Config holds per-event settings that
 * save on their own, like who gets sales alerts.
 *
 * A new event uses the same page with only the Set up group; creating it
 * lands on its Overview.
 */

const PAGES = [
  "overview",
  "summary",
  "details",
  "tiers",
  "costs",
  "staff",
  "wallet",
  "orders",
  "tickets",
  "codes",
  "campaigns",
  "comps",
  "links",
  "alerts",
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

  const groups: SectionNavGroup[] = [
    ...(event
      ? [
          {
            items: [
              { value: "overview", label: "Overview", icon: LayoutDashboard },
              { value: "summary", label: "Summary", icon: ClipboardList },
            ],
          },
        ]
      : []),
    {
      label: "Set up",
      items: [
        {
          value: "details",
          label: "Details",
          icon: FileText,
          dirty: dirty.includes("details"),
        },
        {
          value: "tiers",
          label: "Tiers",
          icon: Layers,
          count: draft.tiers.length,
          dirty: dirty.includes("tiers"),
        },
        {
          value: "costs",
          label: "Costs",
          icon: Receipt,
          count: draft.costs.length + (draft.venueHire.trim() ? 1 : 0),
          dirty: dirty.includes("costs"),
        },
        {
          value: "staff",
          label: "Door staff",
          icon: UsersRound,
          count: draft.staff.length,
          dirty: dirty.includes("staff"),
        },
        {
          value: "wallet",
          label: "Wallet pass",
          icon: WalletCards,
          dirty: dirty.includes("wallet"),
        },
      ],
    },
    ...(event
      ? [
          {
            label: "Sell",
            items: [
              {
                value: "orders",
                label: "Orders",
                icon: ShoppingCart,
                count: event.counts.orders,
              },
              {
                value: "tickets",
                label: "Tickets",
                icon: TicketCheck,
                count: event.counts.tickets,
              },
              { value: "codes", label: "Codes", icon: BadgePercent },
              {
                value: "campaigns",
                label: "Campaigns",
                icon: Megaphone,
                count: event.campaigns.length,
              },
            ],
          },
          {
            label: "Give away",
            items: [
              {
                value: "comps",
                label: "Comps",
                icon: Gift,
                count: event.counts.comps,
              },
              {
                value: "links",
                label: "Ticket links",
                icon: Link2,
                count: event.counts.linkBatches,
              },
            ],
          },
          {
            label: "Config",
            items: [{ value: "alerts", label: "Sales alerts", icon: BellRing }],
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
                <Link href={`/admin/events/${event.id}/live`}>Live screen</Link>
              </Button>
            ) : null}
            <EventMenu event={event} />
          </div>
        ) : undefined
      }
    >
      {/* The page's one and only Save, above every section. */}
      <SaveBar
        status={status}
        errorMessage={errorMessage}
        message={
          status === "dirty"
            ? `Unsaved: ${dirty.map((s) => SECTION_LABEL[s]).join(", ")}. Cmd+S saves every section at once.`
            : status === "idle"
              ? event
                ? "Everything here is up to date."
                : "Fill in the details, then create the event."
              : null
        }
        saveLabel={event ? "Save" : "Create event"}
        isSaving={isSaving}
        onSave={() => void save()}
        onDiscard={isDirty && event ? state.discard : undefined}
      >
        <SectionNav
          title={event ? event.name : "New ticketed event"}
          status={
            event ? <EventStatusBadge status={event.status} /> : undefined
          }
          backLink={{ href: "/admin/events", label: "Events" }}
          groups={groups}
          value={page}
          onValueChange={nav.onValueChange}
        />
        <div className="min-w-0">
          {page === "overview" && event ? (
            <OverviewSection
              event={event}
              checklist={checklist}
              onOpenSection={open}
            />
          ) : null}
          {page === "summary" && event ? (
            <EventSummary eventId={event.id} />
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
          {page === "wallet" ? (
            <WalletSection state={state} gigPosterId={gigPosterId} />
          ) : null}
          {page === "orders" && event ? (
            <OrdersPanel eventId={event.id} />
          ) : null}
          {page === "tickets" && event ? (
            <TicketsPanel eventId={event.id} />
          ) : null}
          {page === "codes" && event ? <EventCodesPanel event={event} /> : null}
          {page === "campaigns" && event ? (
            <CampaignsPanel event={event} />
          ) : null}
          {page === "comps" && event ? <CompsPanel event={event} /> : null}
          {page === "links" && event ? (
            <TicketLinksPanel event={event} />
          ) : null}
          {page === "alerts" && event ? (
            <SalesAlertsPanel eventId={event.id} />
          ) : null}
        </div>
      </SaveBar>
    </AdminSection>
  );
}
