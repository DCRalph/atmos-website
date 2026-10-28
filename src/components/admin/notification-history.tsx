"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight, Loader2, Search } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { formatDateTime } from "~/lib/date-utils";
import {
  isPriority,
  isPublishSource,
  KNOWN_TOPICS,
  PRIORITY_LABELS,
  PUBLISH_SOURCES,
  type PublishSource,
} from "~/lib/notify/topics";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { DetailRow } from "~/components/admin/detail-row";
import { FilterSelect, ListFilters } from "~/components/admin/list-filters";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

/**
 * Every notification the site has sent, and the full record of any one of
 * them.
 *
 * `NotificationHistory` is the history page. `NotificationDialog` opens a
 * single send from either that page or the compose screen's short list.
 */

export type SentNotification =
  RouterOutputs["notify"]["history"]["messages"][number];

const SOURCE_OPTIONS = Object.entries(PUBLISH_SOURCES).map(
  ([value, { label }]) => ({ value: value as PublishSource, label }),
);

export function NotificationHistory() {
  const [topic, setTopic] = useState<string | null>(null);
  const [source, setSource] = useState<PublishSource | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search).trim();
  const [open, setOpen] = useState<SentNotification | null>(null);

  const topics = api.notify.historyTopics.useQuery();
  const history = api.notify.history.useInfiniteQuery(
    {
      limit: 50,
      topic: topic ?? undefined,
      source: source ?? undefined,
      search: debouncedSearch || undefined,
    },
    { getNextPageParam: (page) => page.nextCursor },
  );

  const rows = history.data?.pages.flatMap((page) => page.messages) ?? [];
  const total = history.data?.pages[0]?.total;
  const filtered = Boolean(topic ?? source ?? debouncedSearch);

  const columns: DataTableColumn<SentNotification>[] = [
    {
      id: "sent",
      header: "Sent",
      sortable: true,
      accessor: (row) => row.createdAt,
      cell: (row) => (
        <div className="text-xs tabular-nums">
          <p>{formatDateTime(row.createdAt)}</p>
          <p className="text-muted-foreground">{ago(row.createdAt)}</p>
        </div>
      ),
    },
    {
      id: "topic",
      header: "Topic",
      sortable: true,
      accessor: (row) => row.topic,
      cell: (row) => (
        <Badge variant="outline" className="font-mono">
          {row.topic}
        </Badge>
      ),
    },
    {
      id: "notification",
      header: "Notification",
      cell: (row) => (
        <div className="max-w-md min-w-48 whitespace-normal">
          <p className="font-medium">{displayTitle(row)}</p>
          <p className="text-muted-foreground line-clamp-2">{row.message}</p>
        </div>
      ),
    },
    {
      id: "source",
      header: "Source",
      sortable: true,
      accessor: (row) => sourceLabel(row.source),
      cell: (row) => (
        <span className="text-muted-foreground">{sourceLabel(row.source)}</span>
      ),
    },
    {
      id: "sender",
      header: "Sender",
      cell: (row) => (
        <span className="text-muted-foreground">{senderLabel(row)}</span>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      sortable: true,
      accessor: (row) => row.priority,
      cell: (row) => (
        <span className="text-muted-foreground">
          {priorityLabel(row.priority).name}
        </span>
      ),
    },
    {
      id: "delivered",
      header: "Delivered",
      align: "right",
      sortable: true,
      accessor: (row) => row.delivered,
      cell: (row) => <DeliveryCount row={row} />,
    },
  ];

  return (
    <div className="space-y-4">
      <ListFilters
        activeCount={[topic, source, debouncedSearch].filter(Boolean).length}
        onClear={() => {
          setTopic(null);
          setSource(null);
          setSearch("");
        }}
        summary={
          total === undefined
            ? null
            : `${total} ${total === 1 ? "notification" : "notifications"}`
        }
      >
        <div className="relative w-full max-w-64">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            placeholder="Search titles and messages"
            aria-label="Search titles and messages"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={200}
            className="h-8 pl-8"
          />
        </div>
        <FilterSelect
          label="Topic"
          value={topic}
          onChange={setTopic}
          options={(topics.data ?? []).map((entry) => ({
            value: entry.topic,
            label: `${entry.topic} (${entry.count})`,
          }))}
          anyLabel="All topics"
        />
        <FilterSelect
          label="Source"
          value={source}
          onChange={setSource}
          options={SOURCE_OPTIONS}
          anyLabel="All sources"
        />
      </ListFilters>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        onRowClick={setOpen}
        isLoading={history.isLoading}
        isFetching={history.isFetching && !history.isFetchingNextPage}
        storageKey="admin-notify-history"
        emptyMessage={
          filtered ? "Nothing sent matches these filters" : "Nothing sent yet"
        }
      />

      {history.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
          >
            {history.isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Loading…
              </>
            ) : (
              <>
                Load more
                <ChevronRight className="ml-2 size-4" aria-hidden />
              </>
            )}
          </Button>
        </div>
      )}

      <NotificationDialog notification={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/** One send in full. Closed while `notification` is null. */
export function NotificationDialog({
  notification,
  onClose,
}: {
  notification: SentNotification | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={notification !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        {notification && <NotificationDetail row={notification} />}
      </DialogContent>
    </Dialog>
  );
}

function NotificationDetail({ row }: { row: SentNotification }) {
  const priority = priorityLabel(row.priority);
  const source = isPublishSource(row.source)
    ? PUBLISH_SOURCES[row.source]
    : undefined;
  const missed = row.devices - row.delivered;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="break-words">{displayTitle(row)}</DialogTitle>
        <DialogDescription>
          {formatDateTime(row.createdAt, { includeSeconds: true })} ·{" "}
          {ago(row.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <p className="bg-muted/40 rounded-md border p-3 text-sm break-words whitespace-pre-wrap">
          {row.message}
        </p>
        {!row.title && (
          <p className="text-muted-foreground -mt-2 text-xs">
            Sent without a title, so handsets showed the topic name instead.
          </p>
        )}

        <dl className="space-y-1 text-sm">
          <DetailRow
            label="Topic"
            value={
              <Badge variant="outline" className="font-mono">
                {row.topic}
              </Badge>
            }
          />
          <DetailRow
            label="Priority"
            value={`${priority.name} · ${priority.effect}`}
          />
          <DetailRow
            label="Tags"
            value={
              row.tags.length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {row.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </span>
              ) : (
                "None"
              )
            }
          />
          <DetailRow
            label="Opens"
            value={
              row.click ? (
                <span className="font-mono text-xs break-all">{row.click}</span>
              ) : (
                "The app"
              )
            }
          />
          <DetailRow label="Source" value={source?.label ?? row.source} />
          <DetailRow
            label="Sent by"
            value={
              row.sender ? (
                <Link
                  href={`/admin/users/${row.sender.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {row.sender.name}
                </Link>
              ) : (
                senderLabel(row)
              )
            }
          />
        </dl>

        <dl className="space-y-1 border-t pt-4 text-sm">
          <DetailRow label="Devices" value={row.devices} />
          <DetailRow label="Delivered" value={row.delivered} />
          <DetailRow
            label="Not delivered"
            value={
              <span className={missed > 0 ? "text-amber-500" : undefined}>
                {missed}
              </span>
            }
          />
        </dl>

        <p className="text-muted-foreground border-t pt-4 text-xs">
          {source?.description ?? "Logged under an unknown source"}.{" "}
          {row.devices === 0
            ? "No device was in the audience, so nothing went out."
            : "Delivered counts the pushes Expo accepted for those devices."}
        </p>
        <p className="text-muted-foreground font-mono text-xs">{row.id}</p>
      </div>
    </>
  );
}

function DeliveryCount({ row }: { row: SentNotification }) {
  return (
    <span
      className={`text-xs tabular-nums ${
        row.delivered < row.devices ? "text-amber-500" : "text-muted-foreground"
      }`}
    >
      {row.delivered}/{row.devices}
    </span>
  );
}

/** What the lock screen said: a blank title falls back to the topic's name. */
function displayTitle(row: SentNotification): string {
  return (
    row.title ??
    KNOWN_TOPICS.find((known) => known.name === row.topic)?.label ??
    row.topic
  );
}

function sourceLabel(source: string): string {
  return isPublishSource(source) ? PUBLISH_SOURCES[source].label : source;
}

/** A person, or what sent it when nobody did. */
function senderLabel(row: SentNotification): string {
  if (row.sender) return row.sender.name;
  if (row.source === "api") return "API key";
  if (row.source === "admin") return "Deleted user";
  return "Automatic";
}

function priorityLabel(priority: number) {
  return isPriority(priority)
    ? PRIORITY_LABELS[priority]
    : { name: String(priority), effect: "Unknown" };
}

function ago(at: Date): string {
  return formatDistanceToNowStrict(at, { addSuffix: true });
}
