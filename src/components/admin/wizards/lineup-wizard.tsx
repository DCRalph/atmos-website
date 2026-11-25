"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";

import { api, type RouterInputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { TimeField } from "~/components/ui/time-field";
import { ArtistPicker } from "~/components/admin/gig-edit/artist-picker";
import type { PickedArtist } from "~/components/admin/gig-edit/types";
import { gigPath } from "~/lib/gig-url";
import { formatEventTime } from "~/lib/ticketing/dates";
import {
  minutesOfDay,
  resolveNightTime,
  rollsOver,
} from "~/lib/run-sheet/night";
import { defaultLeadMinutes } from "~/lib/run-sheet/schedule";
import { GigGate } from "./gates";
import { gigEditorHref, gigLabel, type EditorGig } from "./gig-common";
import { changedRows, DiffList, Loading, type DiffRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

const STEPS = [
  { key: "who", label: "Who's playing" },
  { key: "order", label: "Running order" },
  { key: "times", label: "Set times" },
  { key: "review", label: "Review" },
] as const;

/** One slot on the bill. Two or more artists is a back to back. */
export type SetDraft = {
  /** The saved row's id, or a local one for a new slot. */
  key: string;
  id?: string;
  artists: PickedArtist[];
  role: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

const setsOf = (gig: EditorGig): SetDraft[] =>
  gig.scheduleItems
    .filter((row) => row.kind === "SET")
    .map((row) => ({
      key: row.id,
      id: row.id,
      artists: row.artists.map(({ artistProfile }) => ({
        artistProfileId: artistProfile.id,
        handle: artistProfile.handle,
        displayName: artistProfile.displayName,
        avatarFileId: artistProfile.avatarFileId,
        claimStatus: artistProfile.claimStatus,
        isPublished: artistProfile.isPublished,
      })),
      role: row.role ?? "",
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    }));

const billName = (set: SetDraft) =>
  set.artists.map((artist) => artist.displayName).join(" b2b ");

/** What a role says when left empty: last on is the headliner. */
const suggestedRole = (index: number, count: number) =>
  index === count - 1 ? "Headliner" : index === 0 ? "Opening" : "Support";

/** How a slot reads in the review: its place, role and time. */
const describe = (set: SetDraft, index: number) =>
  [
    `#${index + 1}`,
    set.role.trim() || null,
    set.startsAt ? formatEventTime(set.startsAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * The run sheet the update should save: every stored row in running order,
 * with the sets swapped for the wizard's. Sets fill the places sets held
 * before, so load-in, doors and the other cues stay where they were; extra
 * sets follow the last one, and sets taken off are named with `remove`.
 */
type RunSheetRow = NonNullable<
  RouterInputs["gigs"]["update"]["scheduleItems"]
>[number];

function runSheetPatch(gig: EditorGig, sets: SetDraft[]): RunSheetRow[] {
  const queue = [...sets];
  const keep = new Set(sets.flatMap((set) => (set.id ? [set.id] : [])));
  const toRow = (set: SetDraft): RunSheetRow => ({
    ...(set.id ? { id: set.id } : { kind: "SET" as const }),
    artistProfileIds: set.artists.map((artist) => artist.artistProfileId),
    role: set.role.trim() || null,
    startsAt: set.startsAt,
    endsAt: set.endsAt,
    ...(set.id ? {} : { leadMinutes: defaultLeadMinutes("SET") }),
  });

  const stored = gig.scheduleItems;
  const lastSet = stored.reduce(
    (last, row, index) => (row.kind === "SET" ? index : last),
    -1,
  );
  const rows: RunSheetRow[] = [];

  stored.forEach((row, index) => {
    if (row.kind !== "SET") {
      rows.push({ id: row.id });
    } else {
      const next = queue.shift();
      if (next) rows.push(toRow(next));
    }
    if (index === lastSet) rows.push(...queue.splice(0).map(toRow));
  });
  rows.push(...queue.map(toRow));
  for (const row of stored) {
    if (row.kind === "SET" && !keep.has(row.id)) {
      rows.push({ id: row.id, remove: true });
    }
  }
  return rows;
}

/** Set the line-up: who is on, in what order, and when. */
export function LineupWizard() {
  return (
    <GigGate
      wizard="lineup"
      hint={(gig) => (gig.sets === 0 ? "Nobody on the bill" : null)}
    >
      {(gigId) => <Loaded gigId={gigId} />}
    </GigGate>
  );
}

function Loaded({ gigId }: { gigId: string }) {
  const gig = api.gigs.getForEditor.useQuery({ id: gigId });
  if (gig.isPending || !gig.data) {
    return (
      <WizardShell wizard="lineup">
        {gig.isPending ? (
          <Loading />
        ) : (
          <p className="text-sm">That gig is gone.</p>
        )}
      </WizardShell>
    );
  }
  return <Steps gig={gig.data} />;
}

function Steps({ gig }: { gig: EditorGig }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [sets, setSets] = useState(() => setsOf(gig));
  const [isDone, setIsDone] = useState(false);

  const patchSet = (key: string, changes: Partial<SetDraft>) =>
    setSets((all) =>
      all.map((set) => (set.key === key ? { ...set, ...changes } : set)),
    );
  const move = (index: number, by: -1 | 1) =>
    setSets((all) => {
      const next = [...all];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(index + by, 0, moved);
      return next;
    });

  const before = setsOf(gig);
  const beforeIndex = new Map(before.map((set, index) => [set.key, index]));
  const afterKeys = new Set(sets.map((set) => set.key));
  const rows: DiffRow[] = [
    ...sets.map((set, index) => {
      const was = beforeIndex.get(set.key);
      const old = was === undefined ? undefined : before[was];
      return {
        label: old ? billName(set) : `Added: ${billName(set)}`,
        before:
          old && was !== undefined ? describe(old, was) : "Not on the bill",
        after: describe(set, index),
      };
    }),
    ...before
      .filter((set) => !afterKeys.has(set.key))
      .map((set, index) => ({
        label: `Removed: ${billName(set)}`,
        before: describe(set, beforeIndex.get(set.key) ?? index),
        after: "Off the bill",
      })),
  ];
  // A back to back that gained or lost someone keeps its key, so its name
  // changing is a change even when its place, role and time are not.
  const renamed = sets.some((set) => {
    const was = beforeIndex.get(set.key);
    return was !== undefined && billName(before[was]!) !== billName(set);
  });
  const changes = changedRows(rows);
  const isDirty = changes.length > 0 || renamed;

  const save = api.gigs.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.gigs.getForEditor.invalidate({ id: gig.id }),
        utils.wizards.gigChoices.invalidate(),
      ]);
      toast.success("Line-up saved");
      setIsDone(true);
    },
    onError: async (error) => {
      // Somebody else changed the run sheet since this loaded. Reload it and
      // keep what was picked here, so Save can go again.
      await utils.gigs.getForEditor.invalidate({ id: gig.id });
      toast.error(error.message);
    },
  });

  const submit = () =>
    save.mutate({ id: gig.id, scheduleItems: runSheetPatch(gig, sets) });

  return (
    <WizardShell
      wizard="lineup"
      subtitle={gigLabel(gig)}
      editorHref={gigEditorHref(gig.id)}
      steps={steps}
      isDirty={isDirty}
      done={
        isDone ? (
          <DonePanel
            title="Line-up saved"
            description="It is on the gig page, and on the run sheet with the rest of the night."
            next={[
              { key: "poster", gigId: gig.id },
              { key: "sell-tickets", gigId: gig.id },
            ]}
            links={[
              {
                href: gigPath({ id: gig.id, slug: gig.slug, isTba: gig.isTba }),
                label: "See the gig page",
                external: true,
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "who" ? (
        <>
          <WhoIsPlaying sets={sets} onChange={setSets} />
          <WizardFooter onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "order" ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Running order</CardTitle>
                  <CardDescription>
                    First on at the top. The role is free text, like Headliner
                    or Support.
                  </CardDescription>
                </div>
                {sets.some((set) => !set.role.trim()) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSets((all) =>
                        all.map((set, index) => ({
                          ...set,
                          role:
                            set.role.trim() || suggestedRole(index, all.length),
                        })),
                      )
                    }
                  >
                    Fill in roles
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {sets.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Nobody to order yet.
                </p>
              ) : (
                <ul className="divide-border divide-y rounded-lg border">
                  {sets.map((set, index) => (
                    <li
                      key={set.key}
                      className="flex flex-wrap items-center gap-2 px-3 py-2"
                    >
                      <div className="flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Move ${billName(set)} earlier`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Move ${billName(set)} later`}
                          disabled={index === sets.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </Button>
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {billName(set)}
                      </span>
                      <Input
                        value={set.role}
                        onChange={(event) =>
                          patchSet(set.key, { role: event.target.value })
                        }
                        placeholder={suggestedRole(index, sets.length)}
                        aria-label={`Role for ${billName(set)}`}
                        className="w-full sm:w-40"
                        maxLength={80}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <WizardFooter onBack={steps.back} onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "times" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Set times</CardTitle>
              <CardDescription>
                Optional. Leave a time blank if it is not known yet. Times after
                midnight land on the morning after.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sets.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Nobody to time yet.
                </p>
              ) : (
                <ul className="divide-border divide-y rounded-lg border">
                  {sets.map((set) => (
                    <li
                      key={set.key}
                      className="flex flex-wrap items-center gap-3 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {billName(set)}
                      </span>
                      <NightTime
                        label={`${billName(set)} starts`}
                        gigStart={gig.gigStartTime}
                        value={set.startsAt}
                        onChange={(startsAt) => patchSet(set.key, { startsAt })}
                      />
                      <span className="text-muted-foreground text-xs">to</span>
                      <NightTime
                        label={`${billName(set)} ends`}
                        gigStart={gig.gigStartTime}
                        value={set.endsAt}
                        onChange={(endsAt) => patchSet(set.key, { endsAt })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <WizardFooter
            onBack={steps.back}
            onNext={steps.next}
            disabled={sets.some(
              (set) => set.startsAt && set.endsAt && set.endsAt < set.startsAt,
            )}
            hint={
              sets.some(
                (set) =>
                  set.startsAt && set.endsAt && set.endsAt < set.startsAt,
              )
                ? "A set ends before it starts."
                : undefined
            }
          />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList
            rows={changes}
            empty={
              renamed
                ? "A back to back changed who is in it."
                : "Nothing has changed yet."
            }
          />
          <WizardFooter
            onBack={steps.back}
            label="Save line-up"
            onNext={submit}
            disabled={!isDirty}
            isPending={save.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}

/** A set's time as a clock time on the gig's night, marked +1 after midnight. */
function NightTime({
  label,
  gigStart,
  value,
  onChange,
}: {
  label: string;
  gigStart: Date;
  value: Date | null;
  onChange: (value: Date | null) => void;
}) {
  return (
    <TimeField
      ariaLabel={label}
      className="w-[108px] shrink-0"
      value={value ? minutesOfDay(value) : null}
      suffix={value && rollsOver(gigStart, value) ? "+1" : null}
      onChange={(minutes) =>
        onChange(minutes === null ? null : resolveNightTime(gigStart, minutes))
      }
    />
  );
}

/**
 * Who is on the bill, in the order they were added: search to add a slot, add
 * a second name for a back to back, take someone off. The new gig wizard uses
 * it too.
 */
export function WhoIsPlaying({
  sets,
  onChange,
}: {
  sets: SetDraft[];
  onChange: (sets: SetDraft[]) => void;
}) {
  const inUse = sets.flatMap((set) =>
    set.artists.map((artist) => artist.artistProfileId),
  );
  const patchSet = (key: string, changes: Partial<SetDraft>) =>
    onChange(
      sets.map((set) => (set.key === key ? { ...set, ...changes } : set)),
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Who&apos;s playing</CardTitle>
            <CardDescription>
              {sets.length === 0
                ? "Nobody yet."
                : `${sets.length} on the bill.`}{" "}
              Search for an artist, or create a profile if they are new. Add a
              second name to a slot for a back to back.
            </CardDescription>
          </div>
          <ArtistPicker
            excludeIds={inUse}
            onPick={(artist) =>
              onChange([
                ...sets,
                {
                  key: crypto.randomUUID(),
                  artists: [artist],
                  role: "",
                  startsAt: null,
                  endsAt: null,
                },
              ])
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {sets.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Nobody on the bill yet. Press Add artist.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {sets.map((set, index) => (
              <li
                key={set.key}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              >
                <span className="text-muted-foreground w-5 font-mono text-xs">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {set.artists.map((artist, at) => (
                      <span
                        key={artist.artistProfileId}
                        className="inline-flex items-center gap-1 text-sm font-medium"
                      >
                        {at > 0 ? (
                          <span className="text-muted-foreground text-xs font-normal">
                            b2b
                          </span>
                        ) : null}
                        {artist.displayName}
                        {set.artists.length > 1 ? (
                          <button
                            type="button"
                            aria-label={`Take ${artist.displayName} out of this slot`}
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              patchSet(set.key, {
                                artists: set.artists.filter(
                                  (other) =>
                                    other.artistProfileId !==
                                    artist.artistProfileId,
                                ),
                              })
                            }
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        ) : null}
                      </span>
                    ))}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {set.artists
                      .map((artist) => `@${artist.handle}`)
                      .join(", ")}
                  </p>
                </div>
                {set.artists.length < 6 ? (
                  <ArtistPicker
                    compact
                    label="b2b"
                    excludeIds={inUse}
                    onPick={(artist) =>
                      patchSet(set.key, {
                        artists: [...set.artists, artist],
                      })
                    }
                  />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Take ${billName(set)} off the bill`}
                  onClick={() =>
                    onChange(sets.filter((other) => other.key !== set.key))
                  }
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
