"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { env } from "~/env";
import { api, type RouterOutputs } from "~/trpc/react";
import { useConfirm } from "~/components/confirm-provider";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Button } from "~/components/ui/button";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  CAMPAIGN_SOURCE_LABELS,
  CAMPAIGN_SOURCES,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPES,
  campaignSourceOf,
  campaignTypeOf,
  campaignUrl,
  normaliseTag,
  type CampaignSource,
  type CampaignType,
} from "~/lib/ticketing/campaigns";
import { formatEventDate } from "~/lib/ticketing/dates";
import { formatNZD, parsePriceToCents } from "~/lib/ticketing/money";
import { cn } from "~/lib/utils";

/**
 * Campaigns: a tagged link, what it cost, and what it did, as a funnel from
 * clicks to paid orders.
 *
 * On an event (`event` given) a campaign points at the event page unless told
 * otherwise, and its spend counts toward the event's costs. Without one this
 * is the Campaigns page: every campaign, and new ones that are just a link to
 * anywhere, measured against whichever event they end up selling.
 */
type Campaign = RouterOutputs["campaigns"]["list"][number];

/** "Instagram · Story · video", then when it ran if it has dates. */
function describe(campaign: Campaign) {
  const tags = [
    CAMPAIGN_SOURCE_LABELS[campaignSourceOf(campaign.source)],
    CAMPAIGN_TYPE_LABELS[campaignTypeOf(campaign.medium)],
    campaign.content,
  ]
    .filter(Boolean)
    .join(" · ");
  const ran =
    campaign.startsAt || campaign.endsAt
      ? [
          campaign.startsAt ? formatEventDate(campaign.startsAt) : "Before",
          campaign.endsAt ? formatEventDate(campaign.endsAt) : "onwards",
        ].join(campaign.startsAt && campaign.endsAt ? " – " : " ")
      : null;
  return { tags, ran };
}

export function CampaignsPanel({
  event,
}: {
  event?: { id: string; slug: string };
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const utils = api.useUtils();
  const confirm = useConfirm();
  const campaigns = api.campaigns.list.useQuery({ eventId: event?.id });

  // Spend feeds the event's costs, profit and break even; dates mark the
  // sales curve.
  const refresh = () => {
    void utils.campaigns.list.invalidate();
    void utils.ticketEvents.byId.invalidate();
    void utils.ticketAnalytics.invalidate();
  };

  const create = api.campaigns.create.useMutation({
    onSuccess: () => {
      toast.success("Campaign created");
      refresh();
      setCreating(false);
    },
    onError: (error) => toast.error(error.message),
  });
  const update = api.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success("Campaign saved");
      refresh();
      setEditing(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = api.campaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
      setEditing(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const columns: DataTableColumn<Campaign>[] = [
    {
      id: "campaign",
      header: "Campaign",
      sortable: true,
      accessor: (row) => row.name,
      cell: (row) => {
        const { tags, ran } = describe(row);
        return (
          <div className="min-w-0">
            <p className="font-medium">{row.name}</p>
            <p className="text-muted-foreground truncate text-xs">{tags}</p>
            {ran ? (
              <p className="text-muted-foreground truncate text-xs">{ran}</p>
            ) : null}
          </div>
        );
      },
    },
    ...(event
      ? []
      : [
          {
            id: "event",
            header: "Event",
            sortable: true,
            accessor: (row: Campaign) => row.event?.name ?? "",
            cell: (row: Campaign) =>
              row.event ? (
                <Link
                  href={`/admin/events/${row.event.id}?section=campaigns`}
                  className="hover:underline"
                >
                  {row.event.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">Any</span>
              ),
          },
        ]),
    {
      id: "link",
      header: "Link",
      cell: (row) => <LinkCell campaign={row} onMade={refresh} />,
    },
    {
      id: "clicks",
      header: "Clicks",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.results.clicks,
      cell: (row) => row.results.clicks ?? "–",
    },
    {
      id: "views",
      header: "Views",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.results.views,
    },
    {
      id: "checkouts",
      header: "Checkouts",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.results.checkouts,
    },
    {
      id: "paid",
      header: "Paid",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.results.paid,
      cell: (row) =>
        row.results.checkouts > 0
          ? `${row.results.paid} · ${Math.round((row.results.paid / row.results.checkouts) * 100)}%`
          : "0",
    },
    {
      id: "revenue",
      header: "Revenue",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.results.revenueCents,
      cell: (row) => formatNZD(row.results.revenueCents),
    },
    {
      id: "spend",
      header: "Spend",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) => row.spendCents,
      cell: (row) => (row.spendCents > 0 ? formatNZD(row.spendCents) : "–"),
    },
    {
      id: "perOrder",
      header: "Per order",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) =>
        row.spendCents > 0 && row.results.paid > 0
          ? row.spendCents / row.results.paid
          : null,
      cell: (row) =>
        row.spendCents > 0 && row.results.paid > 0
          ? formatNZD(Math.round(row.spendCents / row.results.paid))
          : "–",
    },
    {
      id: "return",
      header: "Return",
      type: "number",
      align: "right",
      sortable: true,
      accessor: (row) =>
        row.spendCents > 0 ? row.results.revenueCents / row.spendCents : null,
      cell: (row) => {
        if (row.spendCents === 0) return "–";
        const times = row.results.revenueCents / row.spendCents;
        return (
          <span
            className={cn(
              times >= 2 && "text-emerald-600 dark:text-emerald-400",
              times < 1 && "text-destructive",
            )}
          >
            {times.toFixed(1)}×
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          {event
            ? "Tagged links for this event. Orders that arrive through one count as its results, and its spend is added to Costs."
            : "Every campaign, and links of your own to anywhere. A link made here counts orders on whichever event it sells."}
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          disabled={creating}
        >
          <Plus className="size-4" aria-hidden /> New campaign
        </Button>
      </div>

      {creating && (
        <CampaignForm
          eventSlug={event?.slug}
          pending={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            create.mutate({ ...values, eventId: event?.id ?? null })
          }
        />
      )}

      {editing && (
        <CampaignForm
          key={editing.id}
          eventSlug={editing.event ? event?.slug : undefined}
          initial={editing}
          pending={update.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(values) => update.mutate({ ...values, id: editing.id })}
          onDelete={async () => {
            const ok = await confirm({
              title: `Delete ${editing.name}?`,
              description:
                "Its orders keep their tags and still show under Where buyers came from. A short link made for it stays.",
              confirmLabel: "Delete",
              variant: "destructive",
            });
            if (ok) remove.mutate({ id: editing.id });
          }}
        />
      )}

      <DataTable
        columns={columns}
        data={campaigns.data ?? []}
        getRowId={(row) => row.id}
        isLoading={campaigns.isPending}
        isFetching={campaigns.isFetching}
        onRowClick={(row) => {
          setCreating(false);
          setEditing(row);
        }}
        storageKey={event ? "admin-event-campaigns" : "admin-campaigns"}
        emptyMessage="No campaigns yet."
      />
    </div>
  );
}

type CampaignValues = {
  name: string;
  source: CampaignSource;
  medium: CampaignType;
  content: string;
  destination: string;
  spendCents: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

/**
 * Making or editing a campaign. The link underneath is built as you type, the
 * same way the server builds it, so what's copied is what gets saved.
 */
function CampaignForm({
  eventSlug,
  initial,
  pending,
  onSubmit,
  onCancel,
  onDelete,
}: {
  /** Set on an event's campaign: a blank destination is its page. */
  eventSlug?: string;
  /** The campaign being edited. Remount (via `key`) to load a different one. */
  initial?: Campaign;
  pending: boolean;
  onSubmit: (values: CampaignValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const eventPage = eventSlug ? `/events/${eventSlug}` : null;
  const [name, setName] = useState(initial?.name ?? "");
  // A campaign from before the lists is read through them, so an old
  // "ig" / "social" edits as Instagram / Other.
  const [source, setSource] = useState<CampaignSource | "">(
    initial ? campaignSourceOf(initial.source) : "",
  );
  const [medium, setMedium] = useState<CampaignType | "">(
    initial ? campaignTypeOf(initial.medium) : "",
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [destination, setDestination] = useState(
    initial && initial.destination !== eventPage ? initial.destination : "",
  );
  const [spend, setSpend] = useState(
    initial?.spendCents ? (initial.spendCents / 100).toFixed(2) : "",
  );
  const [startsAt, setStartsAt] = useState<Date | null>(
    initial?.startsAt ?? null,
  );
  const [endsAt, setEndsAt] = useState<Date | null>(initial?.endsAt ?? null);

  const spendCents = spend.trim() ? parsePriceToCents(spend) : 0;
  const tags = {
    source,
    medium: medium || null,
    name: normaliseTag(name),
    content: normaliseTag(content) || null,
  };
  const target = destination.trim() || eventPage;
  const datesInOrder = !startsAt || !endsAt || endsAt >= startsAt;
  const ready =
    Boolean(tags.name && source && medium && target) &&
    spendCents !== null &&
    datesInOrder;

  let preview: string | null = null;
  if (tags.name && source && target) {
    try {
      preview = campaignUrl(env.NEXT_PUBLIC_APP_URL, target, tags);
    } catch {
      preview = null;
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border p-5 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="campaign-name">Name</Label>
        <Input
          id="campaign-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="final-release"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-source">Where it runs</Label>
        <Select
          value={source}
          onValueChange={(value) => setSource(campaignSourceOf(value))}
        >
          <SelectTrigger id="campaign-source" className="w-full">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_SOURCES.map((option) => (
              <SelectItem key={option} value={option}>
                {CAMPAIGN_SOURCE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-type">Type</Label>
        <Select
          value={medium}
          onValueChange={(value) => setMedium(campaignTypeOf(value))}
        >
          <SelectTrigger id="campaign-type" className="w-full">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_TYPES.map((option) => (
              <SelectItem key={option} value={option}>
                {CAMPAIGN_TYPE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-content">Version</Label>
        <Input
          id="campaign-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="video, photo…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-destination">Goes to</Label>
        <Input
          id="campaign-destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={eventPage ?? "/gigs or https://…"}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="campaign-spend">Spend</Label>
        <Input
          id="campaign-spend"
          inputMode="decimal"
          value={spend}
          onChange={(e) => setSpend(e.target.value)}
          placeholder="0.00"
          className={spendCents === null ? "border-destructive" : ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Ran from</Label>
        <DateTimePicker
          date={startsAt ?? undefined}
          onDateChange={(date) => setStartsAt(date ?? null)}
          placeholder="Any time"
          clearable
        />
      </div>
      <div className="space-y-1.5">
        <Label>Ran until</Label>
        <DateTimePicker
          date={endsAt ?? undefined}
          onDateChange={(date) => setEndsAt(date ?? null)}
          placeholder="Still running"
          clearable
        />
        {!datesInOrder ? (
          <p className="text-destructive text-xs">
            It can&apos;t end before it starts.
          </p>
        ) : null}
      </div>
      <p className="text-muted-foreground self-end pb-2 text-xs">
        Results count what happened between these, and the start is marked on
        the sales curve. Leave both empty to count everything.
      </p>

      <div className="md:col-span-3">
        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs">
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-mono",
              !preview && "text-muted-foreground",
            )}
          >
            {preview ?? "The link appears here once it has a name and a place."}
          </span>
          {preview && <CopyButton text={preview} />}
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs">
          Names are saved lowercase with dashes, the way they appear in the
          link.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 md:col-span-3">
        <Button
          disabled={pending || !ready || !source || !medium}
          onClick={() => {
            if (!source || !medium) return;
            onSubmit({
              name,
              source,
              medium,
              content,
              destination: destination.trim(),
              spendCents: spendCents ?? 0,
              startsAt,
              endsAt,
            });
          }}
        >
          {initial ? "Save" : "Create"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive ml-auto"
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Copy the full link, and the short link: the one it has, or a small form to
 * make it. The short link's own page has the QR codes and the click counts.
 */
function LinkCell({
  campaign,
  onMade,
}: {
  campaign: Campaign;
  onMade: () => void;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const make = api.campaigns.createShortLink.useMutation({
    onSuccess: () => {
      toast.success("Short link made");
      setSlug(null);
      onMade();
    },
    onError: (error) => toast.error(error.message),
  });

  if (slug !== null) {
    return (
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          make.mutate({ id: campaign.id, slug });
        }}
      >
        <span className="text-muted-foreground text-xs">/</span>
        <Input
          autoFocus
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="h-8 w-36 font-mono text-xs"
          aria-label="Short link path"
        />
        <Button size="sm" type="submit" disabled={make.isPending || !slug}>
          Make
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setSlug(null)}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <CopyButton text={campaign.url} label="Copy" />
      {campaign.shortLink ? (
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/admin/links/${campaign.shortLink.id}`}>
            <Link2 className="size-3.5" aria-hidden />/{campaign.shortLink.slug}
          </Link>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSlug(campaign.name)}
        >
          <Link2 className="size-3.5" aria-hidden /> Short link
        </Button>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      aria-label="Copy link"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        toast.success("Link copied.");
      }}
    >
      <Copy className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}
