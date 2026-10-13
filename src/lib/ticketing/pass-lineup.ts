import { billing, sortSchedule } from "~/lib/run-sheet/schedule";

/**
 * What a wallet pass says about who is playing, read off the linked gig's run
 * sheet. Pure, so the pass builder and its tests agree without a database.
 */

/** A set row as the pass loaders select it. */
export type RunSheetSet = {
  label: string | null;
  startsAt: Date | null;
  sortOrder: number;
  artists: readonly { artistProfile: { displayName: string } }[];
};

export type PassLineup = {
  /** Every name on the bill, in running order, each once. */
  performers: string[];
  /** The sets in running order, named the way the run sheet bills them. */
  sets: { name: string; startsAt: Date | null }[];
};

export function lineupFromRunSheet(items: readonly RunSheetSet[]): PassLineup {
  const performers: string[] = [];
  const sets: PassLineup["sets"] = [];

  for (const item of sortSchedule(items)) {
    const artists = item.artists.map((artist) => artist.artistProfile);
    // A hand-typed label wins, as it does everywhere the run sheet is shown.
    const label = item.label?.trim() ?? "";
    const name = label.length > 0 ? label : billing(artists);
    if (!name) continue;
    sets.push({ name, startsAt: item.startsAt });
    for (const artist of artists) {
      if (!performers.includes(artist.displayName)) {
        performers.push(artist.displayName);
      }
    }
  }

  return { performers, sets };
}
