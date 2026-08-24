"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import { Bell, BellOff, SendHorizontal, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  continuesBlock,
  groupReactions,
  MAX_MESSAGE_LENGTH,
  REACTIONS,
  receiptAnchorId,
  seenBy,
} from "~/lib/gig-chat/room";

/**
 * The gig's room, at a desk.
 *
 * The same router the app talks to, so somebody on a laptop is in the same
 * conversation as somebody holding a phone at a door rather than in a parallel
 * one. Polling matches the app's cadence, and stops when the tab is in the
 * background — a room left open on a second monitor overnight should cost
 * nothing.
 *
 * Deliberately not a full chat client. There is no history, no search and no
 * uploads: the app is where this is used, and this is the half of it that
 * matters when you are not at the venue.
 */

const POLL_MS = 5000;

export function GigChatPanel({ gigId }: { gigId: string }) {
  const [draft, setDraft] = useState("");
  const [visible, setVisible] = useState(true);
  const stream = useRef<HTMLDivElement>(null);

  // A backgrounded tab should not poll. `visibilitychange` is the only signal
  // that distinguishes "open" from "actually being looked at".
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const utils = api.useUtils();
  const room = api.gigChat.room.useQuery(
    { gigId },
    { retry: false, refetchInterval: visible ? POLL_MS : false },
  );

  const refresh = () => {
    void utils.gigChat.room.invalidate({ gigId });
  };

  const send = api.gigChat.send.useMutation({ onSuccess: refresh });
  const react = api.gigChat.react.useMutation({ onSuccess: refresh });
  const remove = api.gigChat.remove.useMutation({ onSuccess: refresh });
  const setMuted = api.gigChat.setMuted.useMutation({ onSuccess: refresh });

  const messages = useMemo(() => room.data?.messages ?? [], [room.data]);
  const viewerId = room.data?.viewerId ?? "";
  const anchorId = receiptAnchorId(messages, viewerId);
  const newestId = messages.at(-1)?.id;

  // Pinned to the bottom, but only when something new arrives — scrolling on
  // every poll would fight anybody reading back through the night.
  useEffect(() => {
    const node = stream.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [newestId]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft("");
    send.mutate({ gigId, body });
  };

  if (room.isError) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Room</CardTitle>
          <CardDescription>
            Gig rooms are for admins and whoever is on this gig&apos;s notify
            list. Add yourself to the notify list to join.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Room</CardTitle>
            <CardDescription>
              {room.data
                ? `${room.data.members.length} in the room — every admin, plus this gig's notify list.`
                : "The people working this gig, talking on the day."}
            </CardDescription>
          </div>
          {room.data ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setMuted.mutate({ gigId, muted: !room.data.muted })
              }
            >
              {room.data.muted ? (
                <>
                  <BellOff className="h-4 w-4" />
                  Muted
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Notifying
                </>
              )}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          ref={stream}
          className="max-h-[28rem] min-h-[12rem] space-y-1 overflow-y-auto pr-1"
        >
          {room.isPending ? (
            <p className="text-muted-foreground text-sm">Opening room</p>
          ) : null}

          {room.isSuccess && messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing said yet. This is the room for the night — load-in codes,
              door problems, anything the rest of the team needs.
            </p>
          ) : null}

          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const mine = message.authorId === viewerId;
            const continues = continuesBlock(previous, message);
            const groups = groupReactions(message.reactions, viewerId);
            const receipts =
              message.id === anchorId && room.data
                ? seenBy(room.data.members, message)
                : null;

            return (
              <div key={message.id}>
                <div
                  className={cn(
                    "group flex gap-2",
                    mine && "flex-row-reverse",
                    continues ? "mt-0.5" : "mt-3",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] min-w-0",
                      mine && "flex flex-col items-end",
                    )}
                  >
                    {!continues ? (
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                        {mine ? "You" : message.author.name}
                        <span className="ml-2 font-mono text-[10px] tracking-normal normal-case">
                          {format(message.createdAt, "HH:mm")}
                        </span>
                      </p>
                    ) : null}

                    <div
                      className={cn(
                        "border px-3 py-2 text-sm leading-relaxed break-words",
                        mine ? "bg-muted" : "bg-card",
                        message.deleted &&
                          "text-muted-foreground border-dashed bg-transparent italic",
                      )}
                    >
                      {message.deleted ? "Message deleted" : message.body}
                    </div>

                    <div
                      className={cn(
                        "mt-1 flex flex-wrap items-center gap-1",
                        mine && "justify-end",
                      )}
                    >
                      {groups.map((group) => (
                        <button
                          key={group.emoji}
                          type="button"
                          title={group.names.join(", ")}
                          onClick={() =>
                            react.mutate({
                              messageId: message.id,
                              emoji: group.emoji,
                            })
                          }
                          className={cn(
                            "inline-flex items-center gap-1 border px-1.5 text-xs",
                            group.mine && "bg-muted border-foreground/40",
                          )}
                        >
                          <span>{group.emoji}</span>
                          <span className="text-muted-foreground text-[10px] font-semibold">
                            {group.count}
                          </span>
                        </button>
                      ))}

                      {/* Revealed on hover rather than always drawn: five keys
                          under every message is more chrome than transcript. */}
                      {!message.deleted ? (
                        <span className="hidden items-center gap-1 group-hover:inline-flex">
                          {REACTIONS.filter(
                            (emoji) =>
                              !groups.some((group) => group.emoji === emoji),
                          ).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() =>
                                react.mutate({ messageId: message.id, emoji })
                              }
                              className="text-muted-foreground hover:text-foreground border border-transparent px-1 text-xs"
                            >
                              {emoji}
                            </button>
                          ))}
                          {/* Only where it would work — the server allows the
                              author or an admin. */}
                          {message.canDelete ? (
                            <button
                              type="button"
                              title="Delete message"
                              onClick={() =>
                                remove.mutate({ messageId: message.id })
                              }
                              className="text-muted-foreground hover:text-destructive px-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {receipts && receipts.total > 0 ? (
                  <p className="text-muted-foreground mt-1 text-right text-[10px] font-semibold tracking-wider uppercase">
                    {receipts.names.length === 0
                      ? "Sent"
                      : receipts.names.length === receipts.total
                        ? "Seen by everyone"
                        : `Seen by ${receipts.names.join(", ")}`}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message the room"
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            className="min-h-0 resize-none"
            onKeyDown={(event) => {
              // Enter sends, shift-enter is a new line. A room where sending
              // takes a mouse is a room nobody uses during a door rush.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <Button
            type="button"
            onClick={submit}
            disabled={draft.trim().length === 0 || send.isPending}
          >
            <SendHorizontal className="h-4 w-4" />
            {send.isPending ? "Sending" : "Send"}
          </Button>
        </div>

        {room.data && messages.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Last message{" "}
            {isToday(messages.at(-1)!.createdAt)
              ? format(messages.at(-1)!.createdAt, "HH:mm")
              : format(messages.at(-1)!.createdAt, "EEE d MMM, HH:mm")}
            . Applies immediately — not part of Save.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
