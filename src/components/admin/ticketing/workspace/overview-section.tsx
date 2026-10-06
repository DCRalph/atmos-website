"use client";

import { useState } from "react";
import {
  Check,
  CircleAlert,
  Copy,
  Globe,
  Link2,
  Loader2,
  Lock,
  Minus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useConfirm } from "~/components/confirm-provider";
import { EventOverview } from "~/components/admin/ticketing/event-overview";
import { cn } from "~/lib/utils";
import type { AdminEvent, ChecklistItem, Section } from "./draft";

/**
 * The landing page for an event: whether it's ready, the link to hand out,
 * then the sales dashboard.
 */
export function OverviewSection({
  event,
  checklist,
  onOpenSection,
}: {
  event: AdminEvent;
  checklist: ChecklistItem[];
  onOpenSection: (section: Section) => void;
}) {
  const utils = api.useUtils();
  const publish = api.ticketEvents.setStatus.useMutation({
    onSuccess: () => {
      toast.success("Published. Tickets are on sale.");
      void utils.ticketEvents.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const blocked = checklist.some((item) => item.state === "needed");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between">
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {checklist.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                disabled={!item.section || item.state === "ok"}
                onClick={() => item.section && onOpenSection(item.section)}
                title={item.detail}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  item.state !== "ok" && item.section && "hover:underline",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    item.state === "ok" &&
                      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    item.state === "needed" &&
                      "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    item.state === "advice" && "bg-muted text-muted-foreground",
                  )}
                >
                  {item.state === "ok" ? (
                    <Check className="size-3" />
                  ) : item.state === "needed" ? (
                    <CircleAlert className="size-3" />
                  ) : (
                    <Minus className="size-3" />
                  )}
                </span>
                <span
                  className={cn(
                    item.state === "advice" && "text-muted-foreground",
                  )}
                >
                  {item.label}
                  {item.detail && item.state !== "ok" ? (
                    <span className="text-muted-foreground">
                      : {item.detail}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ShareLink event={event} />
          {event.status === "DRAFT" ? (
            <Button
              disabled={blocked || publish.isPending}
              onClick={() =>
                publish.mutate({ id: event.id, status: "PUBLISHED" })
              }
            >
              {publish.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Publish
            </Button>
          ) : null}
        </div>
      </div>

      <EventOverview eventId={event.id} />
    </div>
  );
}

/**
 * The link to hand out. For a private event the key on the end of it is the
 * whole access control, so rotating it is right here.
 */
function ShareLink({ event }: { event: AdminEvent }) {
  const [copied, setCopied] = useState(false);
  const utils = api.useUtils();
  const confirm = useConfirm();

  const rotate = api.ticketEvents.rotateAccessKey.useMutation({
    onSuccess: () => {
      toast.success("New link created. The old one no longer works.");
      void utils.ticketEvents.byId.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const isPrivate = event.visibility === "PRIVATE";
  const Icon = isPrivate
    ? Lock
    : event.visibility === "UNLISTED"
      ? Link2
      : Globe;

  async function copy() {
    try {
      await navigator.clipboard.writeText(event.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="flex items-center gap-1">
      <code
        className="bg-muted hidden max-w-72 truncate rounded-md px-3 py-2 font-mono text-xs md:block"
        title={
          isPrivate
            ? "Anyone holding this link gets in. Treat it like a password."
            : event.shareUrl
        }
      >
        <Icon className="mr-1.5 inline size-3" aria-hidden />
        {event.shareUrl.replace(/^https?:\/\//, "")}
      </code>
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : isPrivate ? "Copy invite link" : "Copy link"}
      </Button>
      {isPrivate ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Rotate the invite link"
          disabled={rotate.isPending}
          onClick={async () => {
            const ok = await confirm({
              title: "Create a new link?",
              description:
                "Every link already sent stops working immediately, including any a guest has forwarded. Everyone still invited will need the new one. Tickets already bought are unaffected.",
              confirmLabel: "Create new link",
              variant: "destructive",
            });
            if (ok) rotate.mutate({ id: event.id });
          }}
        >
          <RefreshCw className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
