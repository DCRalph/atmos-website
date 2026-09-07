"use client";

import { createElement } from "react";
import {
  Activity,
  BadgePercent,
  Calendar,
  FileText,
  FolderOpen,
  IdCard,
  LogIn,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  Ticket,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { activityTypeLabel, activityTypeTone } from "~/lib/activity-types";

/**
 * How one activity-log entry is labelled and iconed.
 *
 * Both derived from the enum member name rather than looked up per value. The
 * lookup tables this replaced covered 22 of the schema's 89 activity types, so
 * everything the ticketing, rentals and creator features logged showed up as a
 * raw `TICKET_SCAN_OVERRIDE`-style badge with a generic icon.
 */

/** The subject of the activity — the part of the name before the verb. */
const ICONS: [RegExp, LucideIcon][] = [
  [/^USER_PERMISSION_/, ShieldCheck],
  [/^USER_/, User],
  [/^INVITE_/, Mail],
  [/^CREW_MEMBER_/, Users],
  [/^GIG_/, Calendar],
  [/^CONTENT_/, FileText],
  [/^FILE_/, FolderOpen],
  [/^CREATOR_THEME_/, Palette],
  [/^CREATOR_/, Sparkles],
  [/^(GEAR|PACKAGE|RENTAL)_/, FolderOpen],
  [/^(DISCOUNT_RULE|DISCOUNT_CODE)_/, BadgePercent],
  [/^PATRON_/, IdCard],
  [/^(TICKET|DOOR_STAFF|BOX_OFFICE)/, Ticket],
  [/^LOG(IN|OUT)$/, LogIn],
];

export function activityIcon(type: string): LucideIcon {
  return ICONS.find(([pattern]) => pattern.test(type))?.[1] ?? Activity;
}

const TONE_VARIANT = {
  created: "default",
  updated: "secondary",
  removed: "destructive",
  neutral: "outline",
} as const;

export function ActivityTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant={TONE_VARIANT[activityTypeTone(type)]} className="text-xs">
      {activityTypeLabel(type)}
    </Badge>
  );
}

/** The icon and the badge together, as every activity table shows them. */
export function ActivityTypeCell({ type }: { type: string }) {
  return (
    <div className="flex items-center gap-2">
      {createElement(activityIcon(type), {
        className: "text-muted-foreground h-4 w-4",
        "aria-hidden": true,
      })}
      <ActivityTypeBadge type={type} />
    </div>
  );
}

/**
 * The `details` blob, which the router has already parsed out of its JSON
 * column. Rendered as `key: value` pairs rather than raw JSON, which is what
 * used to land in the table complete with braces and quotes.
 */
export function ActivityDetails({ details }: { details: unknown }) {
  if (details == null || typeof details !== "object") return null;
  const entries = Object.entries(details as Record<string, unknown>);
  if (entries.length === 0) return null;

  return (
    <p className="text-muted-foreground mt-1 text-xs">
      {entries
        .map(([key, value]) => `${detailLabel(key)}: ${describe(value)}`)
        .join(" · ")}
    </p>
  );
}

/** "patronId" -> "Patron id". */
function detailLabel(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function describe(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "—";
}
