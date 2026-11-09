"use client";

import { toast } from "sonner";

import { api } from "~/trpc/react";
import { useConfirm } from "~/components/confirm-provider";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { formatEventDateTime } from "~/lib/ticketing/dates";

const VIA: Record<string, string> = {
  ONE_CLICK: "their mail app's Unsubscribe button",
  PAGE: "their preferences page",
  COMPLAINT: "marking a mailout as spam",
  ADMIN: "an admin",
};

/** Where a membership's `source` came from, in words. */
function sourceLabel(source: string) {
  const [kind] = source.split(":");
  switch (kind) {
    case "newsletter-form":
      return "Signup form";
    case "checkout":
      return "Ticket checkout";
    case "photo-signup":
      return "Gig photo signup";
    case "preferences-page":
      return "Their preferences page";
    case "import":
      return "Imported";
    case "admin":
      return "Added by an admin";
    default:
      return source;
  }
}

/** One subscriber: their lists, how they joined and left, what they got. */
export function SubscriberSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Subscriber</SheetTitle>
          <SheetDescription>
            How they joined each list is the consent on record.
          </SheetDescription>
        </SheetHeader>
        {id && <Detail key={id} id={id} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const subscriber = api.subscribers.get.useQuery({ id });
  const refresh = () => {
    void utils.subscribers.invalidate();
    void utils.mailingLists.list.invalidate();
  };
  const onError = (error: { message: string }) => toast.error(error.message);
  const remove = api.subscribers.removeFromList.useMutation({
    onSuccess: refresh,
    onError,
  });
  const unsuppress = api.subscribers.unsuppress.useMutation({
    onSuccess: refresh,
    onError,
  });
  const destroy = api.subscribers.delete.useMutation({
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError,
  });

  const data = subscriber.data;
  if (!data) {
    return <p className="text-muted-foreground px-4 text-sm">Loading</p>;
  }

  return (
    <div className="space-y-6 px-4 pb-6">
      <div>
        <p className="font-medium break-all">{data.email}</p>
        <p className="text-muted-foreground text-xs">
          Added {formatEventDateTime(data.createdAt)}
        </p>
      </div>

      {data.suppressedAt && (
        <div className="space-y-2 border-l-2 border-red-500 pl-3 text-sm">
          <p>
            No marketing goes here:{" "}
            {data.suppressedReason === "COMPLAINED"
              ? "they marked a mailout as spam"
              : data.suppressedReason === "RESEND"
                ? "Resend refuses this address"
                : "the address bounced"}{" "}
            on {formatEventDateTime(data.suppressedAt)}.
          </p>
          {data.suppressedReason !== "COMPLAINED" && (
            <Button
              size="sm"
              variant="outline"
              disabled={unsuppress.isPending}
              onClick={() => unsuppress.mutate({ id })}
            >
              Mail them again
            </Button>
          )}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Lists
        </h3>
        {data.memberships.length === 0 && (
          <p className="text-muted-foreground text-sm">On no lists.</p>
        )}
        <ul className="divide-y">
          {data.memberships.map((membership) => (
            <li
              key={membership.listId}
              className="flex items-start justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{membership.list.name}</p>
                <p className="text-muted-foreground text-xs">
                  {sourceLabel(membership.source)},{" "}
                  {formatEventDateTime(membership.subscribedAt)}
                </p>
                {membership.unsubscribedAt && (
                  <p className="text-muted-foreground text-xs">
                    Left {formatEventDateTime(membership.unsubscribedAt)}
                    {membership.unsubscribedVia &&
                      ` from ${VIA[membership.unsubscribedVia]}`}
                  </p>
                )}
              </div>
              {!membership.unsubscribedAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate({ id, listId: membership.listId })
                  }
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Mailouts
        </h3>
        {data.received.length === 0 && (
          <p className="text-muted-foreground text-sm">None sent yet.</p>
        )}
        <ul className="divide-y">
          {data.received.map((recipient) => (
            <li key={recipient.id} className="py-2 text-sm">
              <p className="truncate">{recipient.mailout.subject}</p>
              <p className="text-muted-foreground text-xs">
                {recipient.complainedAt
                  ? "Marked as spam"
                  : recipient.bouncedAt
                    ? "Bounced"
                    : recipient.clickedAt
                      ? "Clicked"
                      : recipient.deliveredAt
                        ? "Delivered"
                        : recipient.status === "SENT"
                          ? "Sent"
                          : recipient.status === "QUEUED"
                            ? "Queued"
                            : (recipient.error ?? recipient.status)}
                {recipient.sentAt &&
                  `, ${formatEventDateTime(recipient.sentAt)}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Button
        variant="destructive"
        disabled={destroy.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: "Delete this subscriber?",
            description: `Forgets ${data.email} completely, including that they unsubscribed. If they only want no more email, remove them from their lists instead.`,
            confirmLabel: "Delete",
            variant: "destructive",
          });
          if (ok) destroy.mutate({ id });
        }}
      >
        Delete subscriber
      </Button>
    </div>
  );
}
