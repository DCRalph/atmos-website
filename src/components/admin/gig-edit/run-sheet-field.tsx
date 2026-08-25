"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, GripVertical, Plus, StickyNote, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  billing,
  flattenGroups,
  groupSchedule,
  kindLabel,
  shiftSchedule,
  type ScheduleGroup,
} from "~/lib/run-sheet/schedule";
import {
  minutesOfDay,
  resolveNightTime,
  rollsOver,
} from "~/lib/run-sheet/night";
import { TimeField } from "~/components/ui/time-field";
import { cn } from "~/lib/utils";
import type { GigScheduleKind } from "~Prisma/browser";
import {
  CreatorAvatar,
  CreatorPicker,
  CreatorStatusBadges,
} from "./creator-picker";
import {
  CueRecipientsField,
  GigRecipientsField,
  useStaffDirectory,
} from "./recipients-field";
import { newScheduleItem, type DraftScheduleItem } from "./types";

/**
 * The run sheet, in the gig editor.
 *
 * One timeline, grouped by part of the night. The line-up is not a separate
 * card any more: a set is a row here, and the public bill is built from the set
 * rows and nothing else, so a name is typed once and a set time is typed once.
 *
 * Grouped rather than flat because an empty group is a prompt. "Before doors"
 * with nothing in it asks for a sound check; a flat empty list asks for
 * nothing. The groups are derived from the kind of each row, so there is no
 * second thing to keep in sync — see `groupSchedule`.
 *
 * Buffered like the rest of the editor: nothing here reaches the database until
 * Save.
 */

/** Which kinds each group offers, beyond the artist picker. */
const GROUP_ACTIONS: Record<ScheduleGroup, GigScheduleKind[]> = {
  BEFORE: ["LOAD_IN", "SOUND_CHECK"],
  DOORS: ["DOORS"],
  SHOW: [],
  AFTER: ["CURFEW"],
};

type RunSheetFieldProps = {
  schedule: DraftScheduleItem[];
  onChange: (schedule: DraftScheduleItem[]) => void;
  notifyUserIds: string[];
  onNotifyChange: (userIds: string[]) => void;
  /** The night every typed time is resolved against. */
  gigStart: Date | undefined;
  /** Rows that have already announced themselves, which "running late" leaves alone. */
  firedItemIds: Set<string>;
  /** A linked ticket event's door time, used to seed the doors row once. */
  ticketEventDoorsAt: Date | null;
  disabled?: boolean;
};

export function RunSheetField({
  schedule,
  onChange,
  notifyUserIds,
  onNotifyChange,
  gigStart,
  firedItemIds,
  ticketEventDoorsAt,
  disabled,
}: RunSheetFieldProps) {
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const { byId } = useStaffDirectory();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const grouped = groupSchedule(schedule);
  const flat = flattenGroups(grouped);
  const hasDoors = schedule.some((row) => row.kind === "DOORS");

  /**
   * Every change lands here. The array is the running order, so `sortOrder` is
   * written from it before the rows are regrouped — otherwise a drag would be
   * undone by the regroup that follows it.
   */
  const commit = (rows: DraftScheduleItem[]) => {
    const ordered = rows.map((row, index) => ({ ...row, sortOrder: index }));
    onChange(flattenGroups(groupSchedule(ordered)));
  };

  const patch = (key: string, changes: Partial<DraftScheduleItem>) => {
    commit(flat.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  };

  const remove = (key: string) => {
    commit(flat.filter((row) => row.key !== key));
  };

  /** Appends to the end of a group, which is what makes the group buttons work. */
  const addToGroup = (group: ScheduleGroup, row: DraftScheduleItem) => {
    commit(
      grouped.flatMap((entry) =>
        entry.group === group ? [...entry.rows, row] : entry.rows,
      ),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = flat.findIndex((row) => row.key === active.id);
    const to = flat.findIndex((row) => row.key === over.id);
    if (from < 0 || to < 0) return;
    commit(arrayMove(flat, from, to));
  };

  const runLate = (minutes: number) => {
    commit(
      shiftSchedule(flat, minutes, (row) =>
        row.id ? firedItemIds.has(row.id) : false,
      ),
    );
  };

  const silentCount = notifyUserIds.filter(
    (id) => byId.get(id)?.devices === 0,
  ).length;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Run sheet</CardTitle>
            <CardDescription>
              Doors, sound check and every set on one timeline. The set rows are
              the line-up; the public page shows those names and nothing else.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {notifyUserIds.length === 0
                ? "Nobody is being told"
                : `${notifyUserIds.length} ${notifyUserIds.length === 1 ? "person" : "people"}${
                    silentCount > 0 ? `, ${silentCount} without the app` : ""
                  }`}
            </span>
            <RunningLate onShift={runLate} disabled={disabled} />
          </div>
        </div>

        <GigRecipientsField
          userIds={notifyUserIds}
          onChange={onNotifyChange}
          disabled={disabled}
        />
      </CardHeader>

      <CardContent className="p-0">
        {!gigStart ? (
          <p className="text-muted-foreground border-t px-6 py-3 text-xs">
            Set the gig&apos;s date and time first. Every time on the run sheet
            is read against that night, so a 1am curfew knows it is the morning
            after.
          </p>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={flat.map((row) => row.key)}
            strategy={verticalListSortingStrategy}
          >
            {grouped.map((entry) => (
              <div key={entry.group}>
                <div className="text-muted-foreground border-t px-6 pt-3 pb-1.5 text-[10px] font-medium tracking-[0.1em] uppercase">
                  {entry.label}
                </div>

                {entry.rows.map((row) => (
                  <ScheduleRowEditor
                    key={row.key}
                    row={row}
                    gigStart={gigStart}
                    previousSetName={previousSetName(flat, row)}
                    isSeededDoors={
                      row.kind === "DOORS" && ticketEventDoorsAt !== null
                    }
                    hasFired={row.id ? firedItemIds.has(row.id) : false}
                    gigUserIds={notifyUserIds}
                    notesOpen={openNotes.has(row.key)}
                    onToggleNotes={() =>
                      setOpenNotes((current) => {
                        const next = new Set(current);
                        if (next.has(row.key)) next.delete(row.key);
                        else next.add(row.key);
                        return next;
                      })
                    }
                    disabled={disabled}
                    onPatch={(changes) => patch(row.key, changes)}
                    onRemove={() => remove(row.key)}
                  />
                ))}

                <div className="flex flex-wrap gap-2 px-6 py-2">
                  {entry.group === "SHOW" ? (
                    // Nothing is excluded: an artist opening and closing the
                    // same night is two slots, and that is allowed.
                    <CreatorPicker
                      excludeIds={[]}
                      disabled={disabled}
                      onPick={(creator) =>
                        addToGroup(
                          "SHOW",
                          newScheduleItem({ kind: "SET", artists: [creator] }),
                        )
                      }
                    />
                  ) : null}

                  {GROUP_ACTIONS[entry.group]
                    .filter((kind) => kind !== "DOORS" || !hasDoors)
                    .map((kind) => (
                      <Button
                        key={kind}
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() =>
                          addToGroup(
                            entry.group,
                            newScheduleItem({
                              kind,
                              startsAt:
                                kind === "DOORS" ? ticketEventDoorsAt : null,
                            }),
                          )
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {kindLabel(kind)}
                      </Button>
                    ))}

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      addToGroup(
                        entry.group,
                        newScheduleItem({ kind: "CUSTOM" }),
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Anything else
                  </Button>
                </div>
              </div>
            ))}
          </SortableContext>
        </DndContext>

        <p className="text-muted-foreground border-t px-6 py-3 text-xs">
          A cue goes out on the minute and, where set, the minutes before it.
          Two sets in a row make a changeover on their own. Profiles are managed
          on the{" "}
          <Link
            href="/admin/creator-profiles"
            target="_blank"
            className="hover:text-foreground underline"
          >
            creator profiles
          </Link>{" "}
          page.
        </p>
      </CardContent>
    </Card>
  );
}

/** The set in front of this one, which is what makes a changeover a changeover. */
function previousSetName(
  ordered: readonly DraftScheduleItem[],
  row: DraftScheduleItem,
): string | null {
  if (row.kind !== "SET") return null;
  const index = ordered.findIndex((candidate) => candidate.key === row.key);
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = ordered[i];
    if (candidate?.kind === "SET") {
      return candidate.label.trim() || billing(candidate.artists);
    }
  }
  return null;
}

function ScheduleRowEditor({
  row,
  gigStart,
  previousSetName,
  isSeededDoors,
  hasFired,
  gigUserIds,
  notesOpen,
  onToggleNotes,
  disabled,
  onPatch,
  onRemove,
}: {
  row: DraftScheduleItem;
  gigStart: Date | undefined;
  previousSetName: string | null;
  isSeededDoors: boolean;
  hasFired: boolean;
  gigUserIds: string[];
  notesOpen: boolean;
  onToggleNotes: () => void;
  disabled?: boolean;
  onPatch: (changes: Partial<DraftScheduleItem>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.key });

  // A label wins, then the billing, then what kind of thing this is. Empty is
  // a real answer for `label`, so this is not a nullish fallback.
  const typed = row.label.trim();
  const name =
    typed !== "" ? typed : (billing(row.artists) ?? kindLabel(row.kind));

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="border-t px-6 py-2 first:border-t-0"
    >
      {/* Top-aligned, not centered: the artist block can run to two or three
          lines, and centering it against the single-line controls is what made
          the pills overlap them. The controls live in one shrink-proof cluster
          that wraps below the artists as a whole when the row runs out of
          room. */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={`Reorder ${name}`}
          className="text-muted-foreground hover:text-foreground mt-1.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <RowTimeField
          row={row}
          gigStart={gigStart}
          disabled={disabled}
          onPatch={onPatch}
        />

        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-2 gap-y-1">
          {row.kind === "SET" ? (
            <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {row.artists.map((artist, index) => (
                  <span
                    key={artist.creatorProfileId}
                    className="flex min-w-0 items-center gap-1.5"
                  >
                    {index > 0 ? (
                      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                        b2b
                      </span>
                    ) : null}
                    <span className="flex min-w-0 items-center gap-1.5 rounded border py-0.5 pr-1 pl-0.5">
                      <CreatorAvatar
                        fileId={artist.avatarFileId}
                        name={artist.displayName}
                        size={22}
                      />
                      <Link
                        href={`/@${artist.handle}`}
                        target="_blank"
                        className="truncate text-sm font-semibold hover:underline"
                      >
                        {artist.displayName}
                      </Link>
                      <CreatorStatusBadges
                        claimStatus={artist.claimStatus}
                        isPublished={artist.isPublished}
                      />
                      {/* A slot needs somebody in it, so the last name is
                            removed by removing the row. */}
                      {row.artists.length > 1 ? (
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`Remove ${artist.displayName} from this slot`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            onPatch({
                              artists: row.artists.filter(
                                (candidate) =>
                                  candidate.creatorProfileId !==
                                  artist.creatorProfileId,
                              ),
                            })
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  </span>
                ))}

                <CreatorPicker
                  label="b2b"
                  compact
                  disabled={disabled}
                  excludeIds={row.artists.map(
                    (artist) => artist.creatorProfileId,
                  )}
                  onPick={(creator) =>
                    onPatch({ artists: [...row.artists, creator] })
                  }
                />
              </div>
              {previousSetName ? (
                <span className="text-muted-foreground truncate text-xs">
                  Changeover from {previousSetName}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 basis-56 flex-col">
              <Input
                aria-label="What this is"
                placeholder={kindLabel(row.kind)}
                value={row.label}
                disabled={disabled}
                onChange={(e) => onPatch({ label: e.target.value })}
                className="h-7 max-w-[240px] text-sm font-medium"
              />
              {isSeededDoors ? (
                <span className="text-muted-foreground mt-0.5 text-xs">
                  Seeded from the ticket event. Changing it here does not change
                  the buy page.
                </span>
              ) : null}
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {row.kind === "SET" ? (
              <Input
                aria-label={`Role for ${name}`}
                placeholder="Role"
                value={row.role}
                disabled={disabled}
                onChange={(e) => onPatch({ role: e.target.value })}
                className="h-7 w-[110px] text-xs"
              />
            ) : null}

            <LeadField row={row} disabled={disabled} onPatch={onPatch} />

            <CueRecipientsField
              gigUserIds={gigUserIds}
              value={row.recipientUserIds}
              onChange={(recipientUserIds) => onPatch({ recipientUserIds })}
              disabled={disabled}
            />

            {hasFired ? (
              <span className="text-[10px] tracking-wide text-emerald-500 uppercase">
                sent
              </span>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onToggleNotes}
              aria-label={`Notes for ${name}`}
              className={cn(
                "h-7 w-7 p-0",
                row.notes.trim() && "text-foreground",
              )}
            >
              <StickyNote className="h-3.5 w-3.5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onRemove}
              aria-label={`Remove ${name}`}
              className="h-7 w-7 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {notesOpen ? (
        <Textarea
          autoFocus
          placeholder="Internal. Never shown on the gig page."
          value={row.notes}
          disabled={disabled}
          onChange={(e) => onPatch({ notes: e.target.value })}
          className="mt-2 ml-7 min-h-16 text-sm"
        />
      ) : row.notes.trim() ? (
        <p className="text-muted-foreground mt-1 ml-7 text-xs">{row.notes}</p>
      ) : null}
    </div>
  );
}

/**
 * A row's time.
 *
 * The field itself knows nothing about nights; it hands back minutes past
 * midnight and this resolves them against the gig's date, so a 1 am curfew
 * lands on the morning after and says so.
 */
function RowTimeField({
  row,
  gigStart,
  disabled,
  onPatch,
}: {
  row: DraftScheduleItem;
  gigStart: Date | undefined;
  disabled?: boolean;
  onPatch: (changes: Partial<DraftScheduleItem>) => void;
}) {
  const nextDay = Boolean(
    gigStart && row.startsAt && rollsOver(gigStart, row.startsAt),
  );

  return (
    <TimeField
      ariaLabel="Time"
      className="w-[108px] shrink-0"
      value={row.startsAt ? minutesOfDay(row.startsAt) : null}
      disabled={!!disabled || !gigStart}
      suffix={nextDay ? "+1" : null}
      onChange={(minutes) =>
        onPatch({
          startsAt:
            minutes === null || !gigStart
              ? null
              : resolveNightTime(gigStart, minutes),
        })
      }
    />
  );
}

/**
 * How far ahead this cue warns.
 *
 * One number, because a run sheet with two warnings per cue is a run sheet
 * nobody reads. The column holds up to four if something ever needs them.
 */
function LeadField({
  row,
  disabled,
  onPatch,
}: {
  row: DraftScheduleItem;
  disabled?: boolean;
  onPatch: (changes: Partial<DraftScheduleItem>) => void;
}) {
  const lead = row.leadMinutes[0];

  return (
    <label className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
      <Clock className="h-3 w-3" />
      <Input
        aria-label={`Minutes of warning before ${billing(row.artists) ?? kindLabel(row.kind)}`}
        inputMode="numeric"
        placeholder="0"
        value={lead === undefined ? "" : String(lead)}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value.replace(/\D/g, ""));
          onPatch({
            leadMinutes: Number.isInteger(next) && next > 0 ? [next] : [],
          });
        }}
        className="h-7 w-11 px-1.5 text-center text-xs tabular-nums"
      />
      min before
    </label>
  );
}

/** Shifting the rest of the night, for a night that is running late. */
function RunningLate({
  onShift,
  disabled,
}: {
  onShift: (minutes: number) => void;
  disabled?: boolean;
}) {
  const [minutes, setMinutes] = useState("10");
  const parsed = Number(minutes);
  const valid = Number.isInteger(parsed) && parsed !== 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          Running late
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <p className="text-muted-foreground text-xs">
          Moves everything that has not been announced yet. Cues already sent
          keep their times, because people were already told.
        </p>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minutes late"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/[^\d-]/g, ""))}
            className="h-8 w-16 text-center tabular-nums"
          />
          <span className="text-muted-foreground text-xs">minutes</span>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={!valid}
            onClick={() => valid && onShift(parsed)}
          >
            Shift
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          A negative number pulls the night forward. Save when you are done.
        </p>
      </PopoverContent>
    </Popover>
  );
}
