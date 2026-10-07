"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import UserAvatar from "~/components/UserAvatar";
import { Button } from "~/components/ui/button";
import { FilterSelect, ListFilters } from "~/components/admin/list-filters";
import { formatTime } from "~/lib/date-utils";
import { cn } from "~/lib/utils";

type Conversation = RouterOutputs["willGpt"]["list"]["rows"][number];

/** How many of a conversation's changes a row shows before linking to the rest. */
const CHANGES_SHOWN = 5;

const SHOW_OPTIONS = [
  { value: "changed", label: "Changed something" },
] as const;

/**
 * Who asked Will GPT for what, and what it changed: one line per
 * conversation, grouped by day. A row opens to the changes alone; the whole
 * conversation is a click further, on its own page.
 */
export function WillGptHistory() {
  const [person, setPerson] = useState<string | null>(null);
  const [show, setShow] = useState<"changed" | null>("changed");

  const people = api.willGpt.people.useQuery();
  const list = api.willGpt.list.useInfiniteQuery(
    {
      limit: 30,
      userId: person ?? undefined,
      changedOnly: show === "changed",
    },
    { getNextPageParam: (page) => page.nextCursor },
  );
  const conversations = list.data?.pages.flatMap((page) => page.rows) ?? [];

  return (
    <div className="space-y-6">
      <ListFilters activeCount={person ? 1 : 0} onClear={() => setPerson(null)}>
        <FilterSelect
          label="Person"
          value={person}
          onChange={setPerson}
          options={(people.data ?? []).map((user) => ({
            value: user.id,
            label: user.name,
          }))}
          anyLabel="Everyone"
        />
        <FilterSelect
          label="Show"
          value={show}
          onChange={setShow}
          options={SHOW_OPTIONS}
          anyLabel="Everything"
        />
      </ListFilters>

      {list.isPending ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {show === "changed"
            ? "No conversations have changed anything yet."
            : "No conversations yet."}
        </p>
      ) : (
        byDay(conversations).map(([day, rows]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-muted-foreground text-xs font-semibold">
              {day}
            </h2>
            {rows.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
              />
            ))}
          </section>
        ))
      )}

      {list.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

const dateLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Rows in order, under "Today", "Yesterday" or the date of their last activity. */
function byDay(rows: Conversation[]): [string, Conversation[]][] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label = (date: Date) =>
    date.toDateString() === today.toDateString()
      ? "Today"
      : date.toDateString() === yesterday.toDateString()
        ? "Yesterday"
        : dateLabel.format(date);

  const groups = new Map<string, Conversation[]>();
  for (const row of rows) {
    const day = label(row.updatedAt);
    groups.set(day, [...(groups.get(day) ?? []), row]);
  }
  return [...groups];
}

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="bg-card rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-3.5 py-2.5 text-left text-sm"
      >
        <UserAvatar
          className="size-6 shrink-0"
          size={12}
          src={conversation.user?.image}
          name={conversation.user?.name}
        />
        <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
        <ChangeState
          count={conversation.changeCount}
          waiting={conversation.awaiting.length}
        />
        <span className="text-muted-foreground shrink-0 text-[13px] whitespace-nowrap">
          <span className="max-sm:hidden">
            {conversation.user?.name ?? "Deleted user"} ·{" "}
          </span>
          {formatTime(conversation.updatedAt)}
        </span>
        <Chevron className="text-muted-foreground size-4 shrink-0" />
      </button>
      {open ? <Changes conversation={conversation} /> : null}
    </div>
  );
}

function ChangeState({ count, waiting }: { count: number; waiting: number }) {
  if (waiting > 0) {
    return (
      <span className="text-destructive flex shrink-0 items-center gap-1.5 text-[13px]">
        <TriangleAlert className="size-3.5" />
        <span className="max-sm:sr-only">Waiting for approval</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[13px]",
        count === 0 && "text-muted-foreground",
      )}
    >
      {count > 0 ? (
        <>
          <Check className="size-3.5 text-emerald-400" />
          {count}
        </>
      ) : (
        "None"
      )}
    </span>
  );
}

/** What one conversation changed, fetched when its row is opened. */
function Changes({ conversation }: { conversation: Conversation }) {
  const changes = api.willGpt.changes.useQuery({ id: conversation.id });
  const shown = changes.data?.slice(0, CHANGES_SHOWN) ?? [];
  const more = (changes.data?.length ?? 0) - shown.length;

  return (
    <div className="flex flex-col gap-0.5 border-t py-2.5 pr-3.5 pl-[3.25rem] text-[13px]">
      {changes.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground">Nothing changed.</p>
      ) : (
        shown.map((change) => (
          <div key={change.callId} className="flex min-h-6 items-center gap-2">
            <Check className="size-3.5 shrink-0 text-emerald-400" />
            <span className="min-w-0 flex-1 truncate">{change.summary}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-[11.5px]">
              {change.path}
            </span>
          </div>
        ))
      )}
      {more > 0 ? (
        <p className="text-muted-foreground min-h-6 leading-6">
          {more === 1 ? "1 more change" : `${more} more changes`}
        </p>
      ) : null}
      {conversation.awaiting.length > 0 ? (
        <p className="text-destructive min-h-6 leading-6">
          {conversation.awaiting.length === 1
            ? "1 call is waiting for approval"
            : `${conversation.awaiting.length} calls are waiting for approval`}
        </p>
      ) : null}
      <div className="mt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/will-gpt/${conversation.id}`}>
            Open conversation
          </Link>
        </Button>
      </div>
    </div>
  );
}
