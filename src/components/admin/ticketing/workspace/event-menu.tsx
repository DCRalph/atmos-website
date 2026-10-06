"use client";

import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Ban,
  Copy,
  ExternalLink,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  ScanLine,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useConfirm } from "~/components/confirm-provider";
import type { AdminEvent } from "./draft";

/**
 * Everything you do to an event that isn't editing it: open it, copy it, and
 * move it between statuses. Publishing lives on Overview beside the checklist,
 * because it has conditions; everything here is a plain action.
 */
export function EventMenu({ event }: { event: AdminEvent }) {
  const router = useRouter();
  const utils = api.useUtils();
  const confirm = useConfirm();

  const setStatus = api.ticketEvents.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      void utils.ticketEvents.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const duplicate = api.ticketEvents.duplicate.useMutation({
    onSuccess: (copy) => {
      toast.success(`Created "${copy.name}" as a draft`);
      void utils.ticketEvents.list.invalidate();
      router.push(`/admin/events/${copy.id}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = api.ticketEvents.delete.useMutation({
    onSuccess: () => {
      toast.success("Event deleted");
      void utils.ticketEvents.list.invalidate();
      router.push("/admin/events");
    },
    onError: (error) => toast.error(error.message),
  });

  const busy = setStatus.isPending || duplicate.isPending || remove.isPending;
  const { status } = event;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="More" disabled={busy}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <a href={`/events/${event.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> View public page
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/door/${event.id}`} target="_blank" rel="noreferrer">
            <ScanLine className="size-4" /> Open scanner
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => duplicate.mutate({ id: event.id })}>
          <Copy className="size-4" /> Duplicate
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {status === "PUBLISHED" ? (
          <DropdownMenuItem
            onClick={() =>
              setStatus.mutate({ id: event.id, status: "SALES_PAUSED" })
            }
          >
            <PauseCircle className="size-4" /> Pause sales
          </DropdownMenuItem>
        ) : null}
        {status === "SALES_PAUSED" || status === "SOLD_OUT" ? (
          <DropdownMenuItem
            onClick={() =>
              setStatus.mutate({ id: event.id, status: "PUBLISHED" })
            }
          >
            <PlayCircle className="size-4" />{" "}
            {status === "SOLD_OUT" ? "Back on sale" : "Resume sales"}
          </DropdownMenuItem>
        ) : null}
        {status === "PUBLISHED" || status === "SALES_PAUSED" ? (
          <DropdownMenuItem
            onClick={() =>
              setStatus.mutate({ id: event.id, status: "SOLD_OUT" })
            }
          >
            <Ban className="size-4" /> Mark sold out
          </DropdownMenuItem>
        ) : null}
        {status !== "CANCELLED" && status !== "ARCHIVED" ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              const ok = await confirm({
                title: "Cancel this event?",
                description:
                  "Sales stop, the public page says cancelled, and wallet passes are updated. Refunds are not automatic: refund the orders yourself.",
                confirmLabel: "Cancel event",
                variant: "destructive",
              });
              if (ok) setStatus.mutate({ id: event.id, status: "CANCELLED" });
            }}
          >
            <Ban className="size-4" /> Cancel event…
          </DropdownMenuItem>
        ) : null}
        {status === "ARCHIVED" ? (
          <DropdownMenuItem
            onClick={() => setStatus.mutate({ id: event.id, status: "DRAFT" })}
          >
            <ArchiveRestore className="size-4" /> Restore as draft
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              setStatus.mutate({ id: event.id, status: "ARCHIVED" })
            }
          >
            <Archive className="size-4" /> Archive
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${event.name}?`,
              description:
                "Only possible before any ticket has been issued. Its tiers and any abandoned checkouts go with it. This cannot be undone.",
              confirmLabel: "Delete event",
              variant: "destructive",
            });
            if (ok) remove.mutate({ id: event.id });
          }}
        >
          <Trash2 className="size-4" /> Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
