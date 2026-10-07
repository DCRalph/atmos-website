"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { AdminSection } from "~/components/admin/admin-section";
import { BucketBarChart, StatTile } from "~/components/admin/ticketing/charts";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import {
  QrDownloadButtons,
  qrHref,
} from "~/components/admin/short-links/qr-downloads";
import { LinkForm } from "~/components/admin/short-links/link-form";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { useConfirm } from "~/components/confirm-provider";
import { useTabParam } from "~/hooks/use-tab-param";
import { formatDateTime } from "~/lib/date-utils";
import { domainLabel, shortLinkUrl } from "~/lib/short-links/domains";

type ShortLink = RouterOutputs["shortLinks"]["byId"];
type Click = ShortLink["recent"][number];
type Slice = ShortLink["breakdown"]["source"][number];

/** One short link: its numbers, its sub links, its clicks and its settings. */
export default function ShortLinkPage() {
  const params = useParams<{ id: string }>();
  const tab = useTabParam(["overview", "sub-links", "clicks", "settings"]);
  const link = api.shortLinks.byId.useQuery({ id: params.id });

  if (link.isPending) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }
  if (!link.data) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">Link not found.</div>
    );
  }

  const data = link.data;
  // Copy and Open use the first host: the main site for a link on all domains.
  const url = shortLinkUrl(data.hosts[0] ?? data.domain, data.slug);

  return (
    <AdminSection
      title={`/${data.slug}`}
      subtitle={`${domainLabel(data.domain)}${data.label ? ` · ${data.label}` : ""}`}
      backLink={{ href: "/admin/links", label: "Links" }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!data.active && <Badge variant="secondary">Switched off</Badge>}
          <CopyButton value={url} />
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden /> Open
            </a>
          </Button>
        </div>
      }
    >
      <Tabs {...tab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sub-links">Sub links</TabsTrigger>
          <TabsTrigger value="clicks">Clicks</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Overview link={data} />
        </TabsContent>
        <TabsContent value="sub-links" className="mt-6">
          <SubLinks link={data} />
        </TabsContent>
        <TabsContent value="clicks" className="mt-6">
          <RecentClicks clicks={data.recent} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <Settings link={data} />
        </TabsContent>
      </Tabs>
    </AdminSection>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

/** Days arrive as "2026-10-04", so they are read and shown as UTC dates. */
const dayLabel = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function Overview({ link }: { link: ShortLink }) {
  const { totals, breakdown } = link;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-5">
        <p className="text-muted-foreground text-sm">Goes to</p>
        <p className="mt-1 font-mono text-sm break-all">{link.destination}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Clicks" value={totals.clicks.toLocaleString()} />
        <StatTile
          label="People"
          value={totals.visitors.toLocaleString()}
          sub="Same phone twice counts once"
        />
        <StatTile
          label="Bots"
          value={totals.bots.toLocaleString()}
          sub="Link previews and crawlers, left out"
        />
      </div>

      <BucketBarChart
        title="Clicks a day, last 30 days"
        buckets={link.daily.map((day) => ({
          x: new Date(`${day.day}T00:00:00Z`),
          y: day.n,
        }))}
        formatX={(date) => dayLabel.format(date)}
        unit={["click", "clicks"]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown title="Where from" slices={breakdown.source} />
        <Breakdown title="Scanned or clicked" slices={breakdown.via} />
        {link.hosts.length > 1 && (
          <Breakdown title="Domain" slices={breakdown.domain} />
        )}
        <Breakdown title="Device" slices={breakdown.device} />
        <Breakdown title="Browser" slices={breakdown.browser} />
        <Breakdown title="System" slices={breakdown.os} />
      </div>
    </div>
  );
}

/** Direct-labelled bars, top eight, as a share of all clicks. */
function Breakdown({ title, slices }: { title: string; slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.n, 0);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-muted-foreground text-sm font-medium">{title}</p>

      {slices.length === 0 && (
        <p className="text-muted-foreground text-sm">No clicks yet.</p>
      )}

      {slices.slice(0, 8).map((slice) => {
        const percent = Math.round((slice.n / total) * 100);
        return (
          <div key={slice.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{slice.label}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {slice.n} · {percent}%
              </span>
            </div>
            <div className="bg-muted mt-1.5 h-2 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percent}%`,
                  background: "var(--ticket-series-arrivals)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub links                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The plain link, plus sub links. Every sub link lands on the same place; the
 * `?c=` on the end is what lets "Cuba St lamp post" be counted apart from
 * "Instagram bio". Each one copies as text or downloads as a QR code. A link on
 * every domain gets a domain picker, which decides which address every row on
 * the tab uses.
 */
function SubLinks({ link }: { link: ShortLink }) {
  const [name, setName] = useState("");
  const [picked, setHost] = useState(link.hosts[0] ?? link.domain);
  // A removed domain drops out of `hosts`; fall back rather than 404.
  const host = link.hosts.includes(picked) ? picked : link.domain;
  const utils = api.useUtils();
  const confirm = useConfirm();

  const create = api.shortLinks.createSubLink.useMutation({
    onSuccess: () => {
      setName("");
      void utils.shortLinks.byId.invalidate({ id: link.id });
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.shortLinks.deleteSubLink.useMutation({
    onSuccess: () => void utils.shortLinks.byId.invalidate({ id: link.id }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      {link.hosts.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="sub-link-host">Addresses on</Label>
          <Select value={host} onValueChange={setHost}>
            <SelectTrigger id="sub-link-host" className="w-64 font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {link.hosts.map((value) => (
                <SelectItem key={value} value={value} className="font-mono">
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <section className="flex flex-wrap items-center gap-5 rounded-lg border p-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- an admin-only SVG from our own route */}
        <img
          src={qrHref(link.id, host, "svg")}
          alt={`QR code for ${shortLinkUrl(host, link.slug)}`}
          className="size-32 rounded-md bg-white"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-lg font-semibold">Plain link</h2>
          <p className="text-muted-foreground font-mono text-sm break-all">
            {shortLinkUrl(host, link.slug)}
          </p>
          <p className="text-muted-foreground text-sm">
            Counted by referrer, or as &ldquo;direct&rdquo;. Make a sub link
            below to count one place it&rsquo;s used on its own.
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={shortLinkUrl(host, link.slug)} size="sm" />
            <QrDownloadButtons linkId={link.id} host={host} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">Sub links</h2>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ linkId: link.id, name });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Where it's used, like Instagram bio or city flyers"
            maxLength={48}
            className="max-w-sm"
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </form>

        {link.subLinks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sub links yet.</p>
        ) : (
          <ul className="divide-y">
            {link.subLinks.map((subLink) => (
              <li
                key={subLink.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{subLink.name}</p>
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {shortLinkUrl(host, link.slug, { code: subLink.code })}
                  </p>
                </div>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {subLink.clicks} clicks · {subLink.scans} from QR
                </span>
                <CopyButton
                  value={shortLinkUrl(host, link.slug, { code: subLink.code })}
                  size="sm"
                />
                <QrDownloadButtons
                  linkId={link.id}
                  host={host}
                  code={subLink.code}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${subLink.name}`}
                  disabled={remove.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete "${subLink.name}"?`,
                      description:
                        "Anywhere it's printed or pasted keeps working, and its past clicks keep the name. New clicks just count like any other visit.",
                      confirmLabel: "Delete",
                      variant: "destructive",
                    });
                    if (ok) remove.mutate({ id: subLink.id });
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Clicks                                                                     */
/* -------------------------------------------------------------------------- */

const clickColumns: DataTableColumn<Click>[] = [
  {
    id: "createdAt",
    header: "When",
    type: "date",
    sortable: true,
    accessor: (row) => row.createdAt,
    cell: (row) => formatDateTime(row.createdAt),
  },
  { id: "source", header: "Where from", accessor: (row) => row.source },
  {
    id: "via",
    header: "How",
    accessor: (row) => row.via,
    cell: (row) =>
      row.via === "qr" ? <Badge variant="outline">QR</Badge> : (row.via ?? "—"),
  },
  {
    id: "url",
    header: "Link used",
    accessor: (row) => row.url ?? row.domain,
    cell: (row) => (
      <span className="font-mono text-xs">{row.url ?? row.domain ?? "—"}</span>
    ),
  },
  {
    id: "device",
    header: "Device",
    accessor: (row) => row.device,
    cell: (row) =>
      row.device === "bot" ? <Badge variant="outline">bot</Badge> : row.device,
  },
  { id: "browser", header: "Browser", accessor: (row) => row.browser },
  { id: "os", header: "System", accessor: (row) => row.os },
  {
    id: "country",
    header: "Country",
    accessor: (row) => row.country,
    cell: (row) => row.country ?? "—",
  },
  {
    id: "referrer",
    header: "Referrer",
    defaultHidden: true,
    accessor: (row) => row.referrer,
    cell: (row) => (
      <span className="block max-w-64 truncate">{row.referrer ?? "—"}</span>
    ),
  },
];

/** The last hundred hits, bots included: the odd row is what explains a link. */
function RecentClicks({ clicks }: { clicks: Click[] }) {
  return (
    <DataTable
      columns={clickColumns}
      data={clicks}
      getRowId={(row) => row.id}
      storageKey="admin-short-link-clicks"
      emptyMessage="No clicks yet."
      description="The last 100, bots included."
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

function Settings({ link }: { link: ShortLink }) {
  const router = useRouter();
  const confirm = useConfirm();
  const utils = api.useUtils();

  const remove = api.shortLinks.delete.useMutation({
    onSuccess: () => {
      toast.success("Link deleted");
      void utils.shortLinks.list.invalidate();
      router.push("/admin/links");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <LinkForm link={link} />

      <section className="border-destructive/40 rounded-lg border p-5">
        <h2 className="font-semibold">Delete this link</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Deletes every click with it, and anything printed starts to 404. To
          stop the redirect but keep the numbers, switch it off instead.
        </p>
        <Button
          variant="destructive"
          className="mt-4"
          disabled={remove.isPending}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete /${link.slug}?`,
              description: `${link.totals.clicks} clicks go with it. This can't be undone.`,
              confirmLabel: "Delete",
              variant: "destructive",
            });
            if (ok) remove.mutate({ id: link.id });
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Delete link
        </Button>
      </section>
    </div>
  );
}
