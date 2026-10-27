"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { useUpload } from "~/hooks/use-upload";
import { TaskField } from "./shared";
export function PasteChat() {
  const [text, setText] = useState(""),
    [images, setImages] = useState<string[]>([]);
  const utils = api.useUtils();
  const extract = api.tasks.extract.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.length} proposals ready`);
      setText("");
      setImages([]);
      void utils.tasks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const upload = useUpload("mediaLibrary", {
    onComplete: (files) =>
      setImages((prev) =>
        [...prev, ...files.map((file) => file.id)].slice(0, 5),
      ),
    onError: (message) => toast.error(message),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        extract.mutate({
          text:
            text.trim() || "Extract commitments from the attached screenshots.",
          imageUploadIds: images,
        });
      }}
    >
      <TaskField label="Paste chat or a brain dump">
        <Textarea
          value={text}
          maxLength={30000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Who said they would do what, and by when?"
          rows={6}
        />
      </TaskField>
      <input
        aria-label="Chat screenshots"
        type="file"
        multiple
        accept={upload.accept}
        disabled={upload.isUploading || images.length >= 5}
        onChange={(e) => {
          if (e.target.files)
            void upload.upload(
              Array.from(e.target.files).slice(0, 5 - images.length),
            );
        }}
      />
      <p className="text-muted-foreground text-xs">
        Text and {images.length} screenshots will be read by AI through
        OpenRouter. Results need acceptance.
      </p>
      <Button
        disabled={
          extract.isPending ||
          upload.isUploading ||
          (!text.trim() && !images.length)
        }
      >
        {extract.isPending ? "Extracting…" : "Propose tasks"}
      </Button>
    </form>
  );
}
export function TaskSettings() {
  const options = api.tasks.options.useQuery();
  const utils = api.useUtils();
  const [feed, setFeed] = useState("");
  const settings = api.tasks.setSettings.useMutation({
    onSuccess: () => {
      void utils.tasks.options.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const calendar = api.tasks.calendarFeed.useMutation({
    onSuccess: (value) =>
      setFeed(
        `${window.location.origin}/api/tasks/calendar/${value.token}.ics`,
      ),
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {options.data ? (
          <>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.data.settings.roundsEnabled}
                disabled={settings.isPending}
                onChange={(e) =>
                  settings.mutate({
                    ...options.data.settings,
                    roundsEnabled: e.target.checked,
                  })
                }
              />
              Rounds ledger (team-wide, opt-in)
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={options.data.settings.nagVoice}
                disabled={settings.isPending}
                onChange={(e) =>
                  settings.mutate({
                    ...options.data.settings,
                    nagVoice: e.target.checked,
                  })
                }
              />
              Atmos reminder voice
            </label>
          </>
        ) : null}
      </div>
      <div className="space-y-3">
        <Button
          variant="outline"
          disabled={calendar.isPending}
          onClick={() => calendar.mutate()}
        >
          Get my private calendar link
        </Button>
        {feed ? (
          <>
            <Input
              readOnly
              value={feed}
              aria-label="Private calendar subscription"
              onFocus={(e) => e.target.select()}
            />
            <p className="text-muted-foreground text-xs">
              Subscribe in Apple or Google Calendar. Anyone with this link can
              read your tasks and gigs.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={calendar.isPending}
              onClick={() => calendar.mutate({ rotate: true })}
            >
              Replace link
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
export function TaskStandings({ onOpen }: { onOpen: (id: string) => void }) {
  const query = api.tasks.standings.useQuery();
  const rounds = api.tasks.rounds.useQuery();
  const utils = api.useUtils();
  const settle = api.tasks.settleRound.useMutation({
    onSuccess: () => {
      void utils.tasks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  type Row = NonNullable<typeof query.data>[number];
  const columns: DataTableColumn<Row>[] = [
    { id: "name", header: "Person" },
    { id: "open", header: "Open" },
    { id: "overdue", header: "Overdue" },
    { id: "onTime", header: "On time" },
    { id: "lateFlagged", header: "Late, flagged" },
    { id: "silentMisses", header: "Silent misses" },
    { id: "rescues", header: "Rescues" },
    { id: "earlyDelays", header: "Early delays" },
    { id: "roundsOwed", header: "Rounds owed" },
  ];
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Last 90 days · Alphabetical · Completion uses the agreed date and stops
        at submission.
      </p>
      <DataTable
        data={query.data ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        isLoading={query.isPending}
        enableSearch={false}
      />
      {rounds.data?.length ? (
        <section>
          <h3 className="mb-2 font-medium">Rounds ledger</h3>
          {rounds.data.map((round) => (
            <div
              key={round.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm"
            >
              <button
                type="button"
                onClick={() => onOpen(round.task.id)}
                className="text-left underline"
              >
                {round.owedBy.name} owes {round.owedTo?.name ?? "the team"} ·{" "}
                {round.task.title}
              </button>
              {round.settledAt || round.waivedAt ? (
                <span className="text-muted-foreground">
                  {round.waivedAt ? "Waived" : "Settled"}
                </span>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={settle.isPending}
                    onClick={() => settle.mutate({ id: round.id })}
                  >
                    Settle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={settle.isPending}
                    onClick={() => {
                      const body = window.prompt("Why waive this round?");
                      if (body?.trim())
                        settle.mutate({ id: round.id, waive: true, body });
                    }}
                  >
                    Waive
                  </Button>
                </div>
              )}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
