"use client";

import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { DEFAULT_PRIORITY, type NotifyPriority } from "~/lib/notify/topics";

/**
 * Sending a team notification.
 *
 * Laid out audience-first: the riskiest part of this screen is not writing the
 * message, it is picking the topic. `announcements` reaches every install and
 * `team` reaches six of us, and in a dropdown those look identical. So the
 * topic list carries its device count, and the devices card beside the
 * composer names the handsets that are about to light up before the button is
 * pressed.
 *
 * The same card is where a handset is subscribed or unsubscribed (the Switch
 * column), which saves a separate device-management page.
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

  // One table of staff handsets: the Switch shows and edits whether each is
  // subscribed to the selected topic.
  const devices = [
    ...(audience.data?.listening ?? []).map((device) => ({
      ...device,
      subscribed: true,
    })),
    ...(audience.data?.missing ?? []).map((device) => ({
      ...device,
      subscribed: false,
    })),
  ];
  type DeviceRow = (typeof devices)[number];
  const deviceColumns: DataTableColumn<DeviceRow>[] = [
    {
      id: "device",
      header: "Device",
      sortable: true,
      accessor: (row) => row.label ?? row.platform,
      className: "font-medium",
    },
    {
      id: "user",
      header: "User",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.user?.name ?? "Signed out"}
        </span>
      ),
    },
    {
      id: "lastSeen",
      header: "Last seen",
      sortable: true,
      accessor: (row) => row.lastSeenAt,
      cell: (row) => (
        <span className="text-muted-foreground text-xs">
          {ago(row.lastSeenAt)}
        </span>
      ),
    },
    {
      id: "subscribed",
      header: "Subscribed",
      align: "right",
      hideable: false,
      cell: (row) => (
        <Switch
          checked={row.subscribed}
          disabled={setDeviceTopic.isPending}
          onCheckedChange={(checked) =>
            setDeviceTopic.mutate({
              deviceId: row.id,
              topic,
              subscribed: checked,
            })
          }
        />
      ),
    },
  ];

  const sentRows = recent.data ?? [];
  type SentRow = (typeof sentRows)[number];
  const sentColumns: DataTableColumn<SentRow>[] = [
    {
      id: "sent",
      header: "Sent",
      sortable: true,
      accessor: (row) => row.createdAt,
      cell: (row) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {ago(row.createdAt)}
        </span>
      ),
    },
    {
      id: "topic",
      header: "Topic",
      cell: (row) => (
        <Badge variant="outline" className="font-mono">
          {row.topic}
        </Badge>
      ),
    },
    {
      id: "message",
      header: "Message",
      cell: (row) => (
        <>
          {row.title && <span className="font-medium">{row.title} </span>}
          <span className="text-muted-foreground">{row.message}</span>
        </>
      ),
    },
    {
      id: "sender",
      header: "Sender",
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.sender?.name ?? <span className="font-mono">api</span>}
        </span>
      ),
    },
    {
      id: "delivered",
      header: "Delivered",
      align: "right",
      cell: (row) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {row.delivered}/{row.devices}
        </span>
      ),
    },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Send a notification</CardTitle>
          <CardDescription>
            Pick the topic first: it decides which devices this reaches
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>Topic</Label>
            <div
              role="radiogroup"
              aria-label="Topic"
              className="divide-border divide-y overflow-hidden rounded-md border"
            >
              {(topics.data ?? []).map((entry) => {
                const selected = entry.name === topic;
                // Everything else here reaches staff. This one reaches punters.
                const reachesPunters = entry.name === "announcements";
                return (
                  <button
                    key={entry.name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTopic(entry.name)}
                    className={`flex w-full items-baseline justify-between gap-4 px-3 py-2 text-left text-sm ${
                      selected
                        ? "bg-primary text-primary-foreground"
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="notify-title">Title</Label>
            <Input
              id="notify-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={250}
              // A blank title is legal: the topic names itself instead.
              placeholder={topic}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notify-message">Message</Label>
            <Textarea
              id="notify-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4096}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div
              role="radiogroup"
              aria-label="Priority"
              className="divide-border grid grid-cols-5 divide-x overflow-hidden rounded-md border"
            >
              {([1, 2, 3, 4, 5] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={value === priority}
                  aria-label={`${PRIORITY_LABELS[value].name} — ${PRIORITY_LABELS[value].effect}`}
                  onClick={() => setPriority(value)}
                  className={`py-2 text-sm ${
                    value === priority
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {PRIORITY_LABELS[value].name}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {PRIORITY_LABELS[priority].effect}
            </p>
          </div>

          <div>
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
                ? "Sending…"
                : `Send to ${audience.data?.subscribed ?? 0} devices`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
            <CardDescription>
              Staff handsets and whether they are subscribed to{" "}
              <span className="font-mono">{topic}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={deviceColumns}
              data={devices}
              getRowId={(row) => row.id}
              isLoading={audience.isLoading}
              storageKey="admin-notify-devices"
              emptyMessage="No staff handsets registered"
            />
            {(audience.data?.others ?? 0) > 0 && (
              <p className="text-muted-foreground mt-2 text-xs">
                And {audience.data?.others} other installs subscribed to{" "}
                <span className="font-mono">{topic}</span>. Counted rather than
                listed, because they are not staff.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently sent</CardTitle>
            <CardDescription>The last 10 notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={sentColumns}
              data={sentRows}
              getRowId={(row) => row.id}
              isLoading={recent.isLoading}
              storageKey="admin-notify-recent"
              emptyMessage="Nothing sent yet"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ago(at: Date): string {
  return formatDistanceToNowStrict(at, { addSuffix: true });
}
