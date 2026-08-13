import type { TicketScanResult } from "~Prisma/client";
import {
  scanResultTone,
  type ScanResultTone,
} from "~/lib/ticketing/scan-results";

import { colors } from "@/lib/theme";

/**
 * The web's `SCAN_TONE_TEXT`, in a form React Native can use.
 *
 * The wording and the grouping of every scan result are shared outright with
 * the website — `~/lib/ticketing/scan-results` is client-safe and reachable
 * through the Metro alias, so a result renamed there changes on the phone at
 * the same time. Only the colours have to be restated: the web map is Tailwind
 * class names, which mean nothing here.
 *
 * Keeping the *mapping* shared and restating only the paint is the point. The
 * previous local copy of these labels had drifted — it was missing `DEPARTED`,
 * `DENIAL_REVERTED` and `NOTE` entirely, so those rendered as raw enum names
 * to somebody working a door in the dark.
 */
export const SCAN_TONE_COLOR: Record<ScanResultTone, string> = {
  in: colors.in,
  out: colors.deny,
  bad: colors.warn,
  neutral: colors.textSoft,
};

export function scanToneColor(result: TicketScanResult): string {
  return SCAN_TONE_COLOR[scanResultTone(result)];
}
