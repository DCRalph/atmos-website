import type { SerializedEditorState } from "lexical";
import type { GigMode, GigScheduleKind } from "~Prisma/browser";
import { defaultLeadMinutes } from "~/lib/run-sheet/schedule";

/**
 * The gig editor is a buffered form: nothing reaches the database until Save.
 * These are the shapes it holds in the meantime.
 */

export type ClaimStatus = "ACTIVE" | "UNCLAIMED" | "PENDING_CLAIM";

/**
 * One run sheet row, with everything needed to render it without another fetch.
 *
 * The line-up is not separate: a `SET` row is a line-up entry, and the public
 * bill is built from those and nothing else.
 *
 * `key` is what the editor drags and what React keys by. It is the database id
 * once a row has been saved and a local one before that. It cannot be the
 * creator, because an artist can open and close the same night.
 */
export type DraftScheduleItem = {
  key: string;
  /** Absent until the row has been saved once. */
  id?: string;
  kind: GigScheduleKind;
  /** Set on `SET` rows, null on every other kind. */
  creatorProfileId: string | null;
  handle: string | null;
  displayName: string | null;
  avatarFileId: string | null;
  claimStatus: ClaimStatus | null;
  isPublished: boolean;
  /** Names a cue, or overrides an artist's name. Empty means neither. */
  label: string;
  /** Free text, e.g. "Headliner". Empty means no role. */
  role: string;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Running order, and the tiebreak when two rows share a time or have none. */
  sortOrder: number;
  /** Internal. Never leaves the admin and staff screens. */
  notes: string;
  /** Minutes before `startsAt` to warn. Empty warns only on the cue. */
  leadMinutes: number[];
  /** Narrows the gig's recipients for this cue. Empty means the gig's list. */
  recipientUserIds: string[];
};

/** A creator profile as the picker hands it over, before it becomes a row. */
export type PickedCreator = {
  creatorProfileId: string;
  handle: string;
  displayName: string;
  avatarFileId: string | null;
  claimStatus: ClaimStatus;
  isPublished: boolean;
};

/**
 * A blank row of a given kind, ready to drop on the timeline.
 *
 * Leads come from the kind rather than from the caller, so a row created by the
 * line-up picker warns the same way as one created by the timeline.
 */
export function newScheduleItem(
  over: Partial<DraftScheduleItem> & { kind: GigScheduleKind },
): DraftScheduleItem {
  return {
    key: crypto.randomUUID(),
    creatorProfileId: null,
    handle: null,
    displayName: null,
    avatarFileId: null,
    claimStatus: null,
    isPublished: true,
    label: "",
    role: "",
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
    notes: "",
    leadMinutes: defaultLeadMinutes(over.kind),
    recipientUserIds: [],
    ...over,
  };
}

/**
 * What Save should do to the poster. `replace` carries the picked file itself:
 * the upload preset keys objects under the gig, so on a brand new gig there is
 * nowhere to put the bytes until the gig exists.
 */
export type PosterDraft =
  { kind: "keep" } | { kind: "replace"; file: File } | { kind: "remove" };

export type GigDraft = {
  title: string;
  subtitle: string;
  shortDescription: string;
  descriptionLexical: SerializedEditorState | null;
  mode: GigMode;
  ticketLink: string;
  startTime: Date | undefined;
  endTime: Date | undefined;
  tagIds: string[];
  /** The run sheet, in running order. `SET` rows are the line-up. */
  schedule: DraftScheduleItem[];
  /** Who hears this gig's cues, unless a row narrows it. */
  notifyUserIds: string[];
  poster: PosterDraft;
};
