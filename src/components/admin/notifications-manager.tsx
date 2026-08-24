"use client";

import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { DEFAULT_PRIORITY, type NotifyPriority } from "~/lib/notify/topics";

/**
 * Sending a team notification.
 *
 * Laid out audience-first: the riskiest part of this screen is not writing the
 * message, it is picking the topic. `announcements` reaches every install and
 * `team` reaches six of us, and in a dropdown those look identical. So the
 * topic list carries its device count, and the panel beside the composer names
 * the handsets that are about to light up before the button is pressed.
 *
 * The same panel is where a handset is subscribed or unsubscribed, which saves
 * a separate device-management page.
 */

const PRIORITY_LABELS: Record<
  NotifyPriority,
  { name: string; effect: string }
> = {
  1: { name: "Min", effect: "Silent" },
  2: { name: "Low", effect: "Silent" },
  3: { name: "Normal", effect: "Sound" },
  4: { name: "High", effect: "Sound, arrives immediately" },
  5: { name: "Max", effect: "Sound, arrives immediately" },
};

export function NotificationsManager() {
  const [topic, setTopic] = useState("team");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<NotifyPriority>(DEFAULT_PRIORITY);

  const topics = api.notify.topics.useQuery();
  const audience = api.notify.audience.useQuery({ topic });
  const recent = api.notify.recent.useQuery({ limit: 10 });

  const send = api.notify.send.useMutation({
    onSuccess: (sent) => {
      toast.success(
        sent.delivery.delivered === 0
          ? "Sent, but no device was subscribed."
          : `Sent to ${sent.delivery.delivered} of ${sent.delivery.devices} devices.`,
      );
      setTitle("");
      setMessage("");
      void recent.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const setDeviceTopic = api.notify.setDeviceTopic.useMutation({
    onSuccess: () => {
      void audience.refetch();
      void topics.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const canSend = message.trim().length > 0 && !send.isPending;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-4">
        <Field label="Topic">
          <div className="border-border divide-border divide-y border">
            {(topics.data ?? []).map((entry) => {
              const selected = entry.name === topic;
              // Everything else here reaches staff. This one reaches punters.
              const reachesPunters = entry.name === "announcements";
              return (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => setTopic(entry.name)}
                  className={`flex w-full items-baseline justify-between gap-4 px-3 py-2 text-left text-sm ${
                    selected
                      ? "bg-foreground text-background"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span className="font-mono">{entry.name}</span>
                  <span
                    className={`ml-auto truncate text-xs ${
                      selected
                        ? "opacity-70"
                        : reachesPunters
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    {entry.description}
                  </span>
                  <span className="tabular-nums">{entry.devices}</span>
                </button>
              );
            })}
            {topics.isLoading && (
              <p className="text-muted-foreground px-3 py-2 text-sm">
                Loading topics
              </p>
            )}
          </div>
        </Field>

        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={250}
            // A blank title is legal: the topic names itself instead.
            placeholder={topic}
          />
        </Field>

        <Field label="Message">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={4096}
            rows={4}
          />
        </Field>

        <Field label="Priority">
          <div className="flex">
            {([1, 2, 3, 4, 5] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value)}
                className={`border-border flex-1 border py-2 text-sm not-first:border-l-0 ${
                  value === priority
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {PRIORITY_LABELS[value].name}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {PRIORITY_LABELS[priority].effect}
          </p>
        </Field>

        <div className="flex items-center gap-4">
          <Button
            disabled={!canSend}
            onClick={() =>
              send.mutate({
                topic,
                title: title.trim() || undefined,
                message: message.trim(),
                priority,
                tags: [],
              })
            }
          >
            {send.isPending
              ? "Sending"
              : `Send to ${audience.data?.subscribed ?? 0} devices`}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div>
          <Legend>Will reach</Legend>
          {audience.data?.listening.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No staff handset is subscribed to{" "}
              <span className="font-mono">{topic}</span>.
            </p>
          )}
          <DeviceTable
            devices={audience.data?.listening ?? []}
            action="Remove"
            busy={setDeviceTopic.isPending}
            onAction={(deviceId) =>
              setDeviceTopic.mutate({ deviceId, topic, subscribed: false })
            }
          />
          {(audience.data?.others ?? 0) > 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              And {audience.data?.others} other installs subscribed to{" "}
              <span className="font-mono">{topic}</span>. Counted rather than
              listed, because they are not staff.
            </p>
          )}
        </div>

        {(audience.data?.missing.length ?? 0) > 0 && (
          <div>
            <Legend>Staff handsets not on this topic</Legend>
            <DeviceTable
              devices={audience.data?.missing ?? []}
              action="Add"
              busy={setDeviceTopic.isPending}
              onAction={(deviceId) =>
                setDeviceTopic.mutate({ deviceId, topic, subscribed: true })
              }
            />
          </div>
        )}

        <div>
          <Legend>Recently sent</Legend>
          <table className="w-full text-sm">
            <tbody>
              {(recent.data ?? []).map((sent) => (
                <tr key={sent.id} className="border-border border-b">
                  <td className="text-muted-foreground w-16 py-2 align-top text-xs tabular-nums">
                    {ago(sent.createdAt)}
                  </td>
                  <td className="py-2 align-top">
                    <span className="font-mono text-xs">{sent.topic}</span>{" "}
                    {sent.title && (
                      <span className="font-medium">{sent.title}</span>
                    )}{" "}
                    <span className="text-muted-foreground">
                      {sent.message}
                    </span>
                  </td>
                  <td className="text-muted-foreground w-28 py-2 text-right align-top text-xs">
                    {sent.sender?.name ?? (
                      <span className="font-mono">api</span>
                    )}{" "}
                    {sent.delivered}/{sent.devices}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">Nothing sent yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

type Device = {
  id: string;
  label: string | null;
  platform: string;
  lastSeenAt: Date;
  user: { id: string; name: string; email: string } | null;
};

function DeviceTable({
  devices,
  action,
  busy,
  onAction,
}: {
  devices: readonly Device[];
  action: string;
  busy: boolean;
  onAction: (deviceId: string) => void;
}) {
  if (devices.length === 0) return null;

  return (
    <table className="w-full text-sm">
      <tbody>
        {devices.map((device) => (
          <tr key={device.id} className="border-border border-b">
            <td className="py-2">{device.label ?? device.platform}</td>
            <td className="text-muted-foreground py-2">
              {device.user?.name ?? "Signed out"}
            </td>
            <td className="text-muted-foreground py-2 text-right text-xs">
              {ago(device.lastSeenAt)}
            </td>
            <td className="w-20 py-2 text-right">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => onAction(device.id)}
              >
                {action}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Legend>{label}</Legend>
      {children}
    </div>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-1.5 text-xs tracking-widest uppercase">
      {children}
    </p>
  );
}

function ago(at: Date): string {
  return formatDistanceToNowStrict(at, { addSuffix: false });
}
