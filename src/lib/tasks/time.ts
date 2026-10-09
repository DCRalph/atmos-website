export const TASK_TIMEZONE = "Pacific/Auckland";
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TASK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function nzParts(date: Date) {
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}
export function dayKey(date: Date) {
  const p = nzParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
/** Convert a calendar day and wall clock to an instant, including NZ daylight saving. */
export function nzDate(day: string, hour = 0, minute = 0) {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const target = Date.UTC(year, month - 1, date, hour, minute);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = nzParts(new Date(instant));
    instant += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(instant);
}
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function formatTaskDate(date: Date) {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: TASK_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function startOfWeek(day: string) {
  return addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}
