"use client";

import { useAccessLevels } from "~/hooks/use-access-levels";
import { isElevated } from "~/lib/ticketing/access-levels";

/**
 * The access level, next to the tier name. Only above general admission
 * unless `always`: on a GA ticket the tier already says everything. Without
 * it an AAA on a tier called "General Admission" reads as general admission.
 */
export function LevelChip({
  accessLevel: code,
  always,
}: {
  accessLevel: string;
  always?: boolean;
}) {
  const level = useAccessLevels().level(code);
  if (!always && !isElevated(code)) return null;
  return (
    <span
      className="t-label ml-2 inline-block rounded-[var(--site-r-chip)] px-1.5 py-1 align-middle text-[9px]"
      style={{ backgroundColor: level.badgeBg, color: level.badgeFg }}
    >
      {level.short}
    </span>
  );
}
