import { QUOTA_TIMEZONE } from "./quotaConstants";

function getIctParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: QUOTA_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    weekday: values.weekday,
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function getQuotaWeekStartIct(date = new Date()): Date {
  const { weekday, year, month, day } = getIctParts(date);
  const offset = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 } as const)[weekday] ?? 0;
  return new Date(Date.UTC(year, month - 1, day - offset, -7));
}

export function getQuotaWeekResetsAtIct(date = new Date()): Date {
  const weekStart = getQuotaWeekStartIct(date);
  return new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
}
