import type { SerializedEditorState } from "lexical";
import type { GigMode } from "~Prisma/browser";

/**
 * The gig editor is a buffered form: nothing reaches the database until Save.
 * These are the shapes it holds in the meantime.
 */

export type ClaimStatus = "ACTIVE" | "UNCLAIMED" | "PENDING_CLAIM";

/** A line-up row, with everything needed to render it without another fetch. */
export type DraftCreator = {
  creatorProfileId: string;
  handle: string;
  displayName: string;
  avatarFileId: string | null;
  claimStatus: ClaimStatus;
  isPublished: boolean;
  /** Free text, e.g. "Headliner". Empty means no role. */
  role: string;
};

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
  creators: DraftCreator[];
  poster: PosterDraft;
};
