export type CalendarEntry = {
  id: string;
  title: string;
  notes?: string | null;
  startsAt: Date;
  updatedAt: Date;
  url: string;
  endsAt?: Date | null;
};
const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
/** Fold by UTF-8 bytes, so emoji and Māori names cannot corrupt a calendar subscription. */
function fold(line: string) {
  const lines: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > 75) {
      lines.push(current);
      current = " ";
      size = 1;
    }
    current += char;
    size += bytes;
  }
  lines.push(current);
  return lines.join("\r\n");
}
export function taskCalendar(entries: readonly CalendarEntry[], now: Date) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atmos//Tasks//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Atmos tasks",
  ];
  for (const entry of entries)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(entry.id)}@atmosmedia.co.nz`,
      `DTSTAMP:${stamp(now)}`,
      `LAST-MODIFIED:${stamp(entry.updatedAt)}`,
      `DTSTART:${stamp(entry.startsAt)}`,
      `DTEND:${stamp(entry.endsAt ?? new Date(entry.startsAt.getTime() + 30 * 60_000))}`,
      `SUMMARY:${escape(entry.title)}`,
      `DESCRIPTION:${escape(entry.notes ?? "")}`,
      `URL:${escape(entry.url)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT2H",
      `DESCRIPTION:${escape(entry.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
