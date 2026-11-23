"use client";

import { useState } from "react";
import { Eye, Link2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { CopyButton } from "~/components/admin/short-links/copy-button";
import { useConfirm } from "~/components/confirm-provider";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PickerSelect } from "~/components/ui/picker-select";

/**
 * Who outside the team can see this event's sales, like a co-promoter. Being
 * on the list opens the read-only organiser pages for this event and no
 * other. Saves on its own, not with the event draft.
 */
export function EventViewersPanel({ eventId }: { eventId: string }) {
  const viewers = api.ticketEvents.viewers.useQuery({ eventId });
  const [pick, setPick] = useState<string | null>(null);

  const onError = (error: { message: string }) => toast.error(error.message);
  const add = api.ticketEvents.addViewer.useMutation({
    onSuccess: () => {
      setPick(null);
      void viewers.refetch();
    },
    onError,
  });
  const remove = api.ticketEvents.removeViewer.useMutation({
    onSuccess: () => void viewers.refetch(),
    onError,
  });

  const rows = viewers.data ?? [];

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Sales access</CardTitle>
        <CardDescription>
          People here can sign in and see this event&apos;s analytics, orders,
          tickets and live screen, read-only, at Event analytics in their
          account menu. They see no other event and can&apos;t scan. Admins and
          event organisers can already see every event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {viewers.isPending ? "Loading…" : "Nobody added yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => (
              <li
                key={row.userId}
                className="flex items-center gap-3 px-3 py-2"
              >
                <Eye
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {row.user.name}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.user.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.user.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ eventId, userId: row.userId })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <PickerSelect
              endpoint={api.pickers.users}
              value={pick}
              onChange={setPick}
              placeholder="Choose someone"
              searchPlaceholder="Name or email…"
              emptyText="Nobody matches. They need an Atmos account first."
            />
          </div>
          <Button
            type="button"
            disabled={!pick || add.isPending}
            onClick={() => pick && add.mutate({ eventId, userId: pick })}
          >
            <UserPlus className="size-4" /> Add
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          They need an Atmos account before you can add them. Access starts and
          ends as soon as you add or remove them.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Links for people who won't sign in. Whoever holds one sees what somebody on
 * the Sales access list sees, for this event only, until it is deleted.
 * Saves on its own, not with the event draft.
 */
export function EventShareLinksPanel({ eventId }: { eventId: string }) {
  const links = api.ticketEvents.shareLinks.useQuery({ eventId });
  const [label, setLabel] = useState("");
  const confirm = useConfirm();

  const onError = (error: { message: string }) => toast.error(error.message);
  const create = api.ticketEvents.createShareLink.useMutation({
    onSuccess: () => {
      setLabel("");
      void links.refetch();
    },
    onError,
  });
  const remove = api.ticketEvents.deleteShareLink.useMutation({
    onSuccess: () => void links.refetch(),
    onError,
  });

  const rows = links.data ?? [];
  const name = label.trim();

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Share links</CardTitle>
        <CardDescription>
          For people who don&apos;t want to sign in. Anyone with a link sees
          this event&apos;s analytics, orders, tickets and live screen,
          read-only, and no other event. Make one per person, so you can turn
          off theirs without touching the others.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {links.isPending ? "Loading…" : "No links yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                <Link2
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    Made {row.createdAt.toLocaleDateString("en-NZ")}
                  </p>
                </div>
                <CopyButton
                  value={`${window.location.origin}/share/${row.token}`}
                  label="Copy link"
                  size="sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete the link for ${row.label}`}
                  disabled={remove.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete the link for ${row.label}?`,
                      description:
                        "It stops working straight away for anyone who has it.",
                      confirmLabel: "Delete link",
                      variant: "destructive",
                    });
                    if (ok) remove.mutate({ id: row.id });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name) create.mutate({ eventId, label: name });
          }}
        >
          <div className="min-w-56 flex-1">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Who it's for"
              aria-label="Who the link is for"
              maxLength={80}
            />
          </div>
          <Button type="submit" disabled={!name || create.isPending}>
            <Plus className="size-4" /> Create link
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">
          A link works for anyone it is forwarded to, and shows buyer names and
          emails. Delete it when it is no longer needed.
        </p>
      </CardContent>
    </Card>
  );
}
