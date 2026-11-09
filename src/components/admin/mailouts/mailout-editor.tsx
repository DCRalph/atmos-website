"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SerializedEditorState } from "lexical";
import { toast } from "sonner";

import { api, type RouterOutputs } from "~/trpc/react";
import { useConfirm } from "~/components/confirm-provider";
import { LexicalRichTextEditor } from "~/components/lexical/rich-text-editor";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ImageUploadField } from "~/components/uploads/image-upload-field";
import { formatEventDateTime } from "~/lib/ticketing/dates";
import { MailoutPreview } from "./mailout-preview";

type Mailout = RouterOutputs["mailouts"]["get"];

type Draft = {
  subject: string;
  previewText: string;
  heading: string;
  body: unknown;
  imageFileId: string | null;
  buttonLabel: string;
  buttonUrl: string;
  listIds: string[];
};

/** How long typing has to stop before the draft is saved. */
const SAVE_AFTER_MS = 800;

/**
 * A draft mailout: who it goes to, what it says, and a live preview. Saves
 * itself as you type. Sending and scheduling ask first and say how many
 * people it will reach.
 */
export function MailoutEditor({ mailout }: { mailout: Mailout }) {
  const router = useRouter();
  const confirm = useConfirm();
  const utils = api.useUtils();
  const me = api.user.me.useQuery();
  const lists = api.mailingLists.list.useQuery();

  const [draft, setDraft] = useState<Draft>(() => ({
    subject: mailout.subject,
    previewText: mailout.previewText ?? "",
    heading: mailout.heading ?? "",
    body: mailout.body,
    imageFileId: mailout.imageFileId,
    buttonLabel: mailout.buttonLabel ?? "",
    buttonUrl: mailout.buttonUrl ?? "",
    listIds: mailout.listIds,
  }));
  const [dirty, setDirty] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [sendAt, setSendAt] = useState<Date | undefined>();

  const edit = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const audience = api.mailouts.audience.useQuery({ listIds: draft.listIds });
  const onError = (error: { message: string }) => toast.error(error.message);
  const save = api.mailouts.update.useMutation({ onError });

  const fields = () => ({
    id: mailout.id,
    subject: draft.subject,
    previewText: draft.previewText.trim() || null,
    heading: draft.heading.trim() || null,
    body: draft.body ?? null,
    imageFileId: draft.imageFileId,
    buttonLabel: draft.buttonLabel.trim() || null,
    buttonUrl: draft.buttonUrl.trim() || null,
    listIds: draft.listIds,
  });

  // Save once typing stops. `fields` reads the latest draft through the
  // closure each time this effect runs.
  const latest = useRef(fields);
  latest.current = fields;
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      setDirty(false);
      save.mutate(latest.current());
    }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
    // `save` is stable enough; only the draft should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  /** Anything unsaved, saved now, before a test or a send reads it back. */
  const flush = async () => {
    setDirty(false);
    await save.mutateAsync(fields());
  };

  const refresh = () => {
    void utils.mailouts.get.invalidate({ id: mailout.id });
    void utils.mailouts.list.invalidate();
  };
  const sendTest = api.mailouts.sendTest.useMutation({
    onSuccess: () => toast.success("Test sent"),
    onError,
  });
  const send = api.mailouts.send.useMutation({
    onSuccess: ({ queued }) => {
      toast.success(`Sending to ${queued.toLocaleString()} people`);
      refresh();
    },
    onError,
  });
  const schedule = api.mailouts.schedule.useMutation({
    onSuccess: () => {
      toast.success("Scheduled");
      refresh();
    },
    onError,
  });
  const remove = api.mailouts.remove.useMutation({
    onSuccess: () => {
      void utils.mailouts.list.invalidate();
      router.push("/admin/mailouts");
    },
    onError,
  });

  const openLists = lists.data?.filter((list) => !list.archivedAt) ?? [];
  const listNames = openLists
    .filter((list) => draft.listIds.includes(list.id))
    .map((list) => list.name);
  const count = audience.data ?? 0;
  const people = `${count.toLocaleString()} ${count === 1 ? "person" : "people"}`;
  // Typing nothing means testing to yourself.
  const testAddress = testTo.trim() ? testTo.trim() : (me.data?.email ?? "");
  const busy = send.isPending || schedule.isPending || save.isPending;
  const ready = draft.subject.trim() && draft.listIds.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-6">
        <section className="space-y-2">
          <Label>Send to</Label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {openLists.map((list) => (
              <label key={list.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.listIds.includes(list.id)}
                  onCheckedChange={(checked) =>
                    edit({
                      listIds: checked
                        ? [...draft.listIds, list.id]
                        : draft.listIds.filter((id) => id !== list.id),
                    })
                  }
                />
                {list.name}
                <span className="text-muted-foreground tabular-nums">
                  {list.subscribed.toLocaleString()}
                </span>
              </label>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Goes to {people}, once each, leaving out anyone who unsubscribed or
            bounced.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="mailout-subject">Subject</Label>
            <Input
              id="mailout-subject"
              value={draft.subject}
              maxLength={200}
              onChange={(e) => edit({ subject: e.target.value })}
              placeholder="Vol. 3 tickets are on sale"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="mailout-preview">Preview text</Label>
            <Input
              id="mailout-preview"
              value={draft.previewText}
              maxLength={200}
              onChange={(e) => edit({ previewText: e.target.value })}
              placeholder="Shown after the subject in the inbox"
            />
          </div>
        </section>

        <ImageUploadField
          preset="mailoutImage"
          value={draft.imageFileId}
          onChange={(imageFileId) => edit({ imageFileId })}
          label="Image"
          helperText="Above the text, full width. Usually the poster."
          aspect="wide"
        />

        <section className="space-y-2">
          <Label htmlFor="mailout-heading">Heading</Label>
          <Input
            id="mailout-heading"
            value={draft.heading}
            maxLength={200}
            onChange={(e) => edit({ heading: e.target.value })}
          />
        </section>

        <section className="space-y-2">
          <Label>Body</Label>
          <LexicalRichTextEditor
            value={draft.body}
            onChange={(body: SerializedEditorState) => edit({ body })}
            namespace={`mailout-${mailout.id}`}
            placeholder="What's happening"
            minHeight="14rem"
          />
          <p className="text-muted-foreground text-xs">
            Text colours and fonts are left out of the email, so it reads the
            same in every inbox.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="mailout-button-label">Button</Label>
            <Input
              id="mailout-button-label"
              value={draft.buttonLabel}
              maxLength={60}
              onChange={(e) => edit({ buttonLabel: e.target.value })}
              placeholder="Get tickets"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mailout-button-url">Button link</Label>
            <Input
              id="mailout-button-url"
              value={draft.buttonUrl}
              onChange={(e) => edit({ buttonUrl: e.target.value })}
              placeholder="https://atmosmedia.co.nz/events/..."
            />
          </div>
          <p className="text-muted-foreground text-xs sm:col-span-2">
            Links to the Atmos site are tagged with this mailout, so tickets
            bought from it show on its results.
          </p>
        </section>

        <section className="space-y-3 border-t pt-6">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="mailout-test">Send a test</Label>
              <Input
                id="mailout-test"
                type="email"
                value={testTo.trim() ? testTo : (me.data?.email ?? "")}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || sendTest.isPending}
              onClick={async () => {
                await flush();
                sendTest.mutate({
                  id: mailout.id,
                  to: testAddress,
                });
              }}
            >
              Send test
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label>Schedule</Label>
              <DateTimePicker date={sendAt} onDateChange={setSendAt} />
            </div>
            <Button
              variant="outline"
              disabled={!ready || !sendAt || busy}
              onClick={async () => {
                if (!sendAt) return;
                const ok = await confirm({
                  title: "Schedule this mailout?",
                  description: `It goes out ${formatEventDateTime(sendAt)} to everyone on ${listNames.join(", ")} then, about ${people} today.`,
                  confirmLabel: "Schedule",
                });
                if (!ok) return;
                await flush();
                schedule.mutate({ id: mailout.id, at: sendAt });
              }}
            >
              Schedule
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete this draft?",
                  confirmLabel: "Delete",
                  variant: "destructive",
                });
                if (ok) remove.mutate({ id: mailout.id });
              }}
            >
              Delete draft
            </Button>
            <Button
              disabled={!ready || busy || count === 0}
              onClick={async () => {
                const ok = await confirm({
                  title: `Send to ${people}?`,
                  description: `Everyone on ${listNames.join(", ")} gets "${draft.subject}" now. It cannot be unsent.`,
                  confirmLabel: "Send now",
                });
                if (!ok) return;
                await flush();
                send.mutate({ id: mailout.id });
              }}
            >
              Send to {people}
            </Button>
          </div>
        </section>
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <MailoutPreview
          draft={{
            subject: draft.subject,
            previewText: draft.previewText,
            heading: draft.heading,
            body: draft.body,
            imageFileId: draft.imageFileId,
            buttonLabel: draft.buttonLabel,
            buttonUrl: draft.buttonUrl,
            slug: mailout.slug,
            listNames,
          }}
        />
      </div>
    </div>
  );
}
