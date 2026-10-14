/**
 * Timezone-aware helpers (restaurant timezone, default Asia/Kolkata).
 * No external tz library: uses Intl to read wall-clock parts.
 */

export const DEFAULT_TZ = process.env.RESTAURANT_TIMEZONE || "Asia/Kolkata";

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface Slot {
  open: string; // "HH:MM"
  close: string; // "HH:MM" (may be "24:00"; close < open means past midnight)
}
export type OpeningHours = Partial<Record<Weekday, Slot[]>>;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz = DEFAULT_TZ): ZonedParts {
  const parts = Object.fromEntries(fmt(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday as string),
  };
}

/** Offset (ms) of tz from UTC at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Wall-clock time in tz → UTC instant. */
export function zonedTimeToUtc(y: number, m: number, d: number, h = 0, mi = 0, tz = DEFAULT_TZ): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, 0);
  let off = tzOffsetMs(new Date(guess), tz);
  let result = guess - off;
  const off2 = tzOffsetMs(new Date(result), tz);
  if (off2 !== off) {
    off = off2;
    result = guess - off;
  }
  return new Date(result);
}

/** "YYYY-MM-DD" of the instant in tz. */
export function zonedDateString(date: Date, tz = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Start of the local day (in tz) for a "YYYY-MM-DD" string, as a UTC instant. */
export function startOfZonedDay(dateStr: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return zonedTimeToUtc(y, m, d, 0, 0, tz);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export interface OpenStatusInput {
  openingHours: OpeningHours;
  override: "auto" | "force_open" | "force_closed";
  acceptingOrders?: boolean;
  tz?: string;
}

export interface OpenStatus {
  isOpen: boolean;
  reason: "override_open" | "override_closed" | "hours" | "closed_hours";
  todaySlots: Slot[];
  nextOpen: string | null; // e.g. "Tue 07:00"
  label: string;
}

/** Open/closed computed from weekly hours + owner override. */
export function computeOpenStatus(input: OpenStatusInput, now = new Date()): OpenStatus {
  const tz = input.tz ?? DEFAULT_TZ;
  const p = zonedParts(now, tz);
  const today = WEEKDAYS[p.weekday];
  const yesterday = WEEKDAYS[(p.weekday + 6) % 7];
  const todaySlots = input.openingHours[today] ?? [];
  const minutes = p.hour * 60 + p.minute;

  if (input.override === "force_closed") {
    return { isOpen: false, reason: "override_closed", todaySlots, nextOpen: null, label: "Closed today" };
  }
  if (input.override === "force_open") {
    return { isOpen: true, reason: "override_open", todaySlots, nextOpen: null, label: "Open now" };
  }

  const inSlot = (s: Slot) => {
    const o = toMinutes(s.open);
    const c = toMinutes(s.close);
    return c > o ? minutes >= o && minutes < c : minutes >= o; // overnight slot: open part today
  };
  const spillover = (input.openingHours[yesterday] ?? []).some((s) => {
    const o = toMinutes(s.open);
    const c = toMinutes(s.close);
    return c <= o && minutes < c;
  });

  const open = todaySlots.some(inSlot) || spillover;
  if (open) {
    const slot = todaySlots.find(inSlot);
    return { isOpen: true, reason: "hours", todaySlots, nextOpen: null, label: slot ? `Open until ${slot.close}` : "Open now" };
  }

  // Next opening within the coming week.
  let nextOpen: string | null = null;
  for (let i = 0; i < 8 && !nextOpen; i++) {
    const wd = WEEKDAYS[(p.weekday + i) % 7];
    for (const s of input.openingHours[wd] ?? []) {
      if (i === 0 && toMinutes(s.open) <= minutes) continue;
      nextOpen = i === 0 ? `today ${s.open}` : i === 1 ? `tomorrow ${s.open}` : `${wd[0].toUpperCase()}${wd.slice(1)} ${s.open}`;
      break;
    }
  }
  return {
    isOpen: false,
    reason: "closed_hours",
    todaySlots,
    nextOpen,
    label: nextOpen ? `Closed · opens ${nextOpen}` : "Closed",
  };
}

/** Is a given instant inside opening hours (ignores override)? Used for reservations / scheduled orders. */
export function isWithinHours(openingHours: OpeningHours, at: Date, tz = DEFAULT_TZ): boolean {
  return computeOpenStatus({ openingHours, override: "auto", tz }, at).isOpen;
}

// ---------------------------------------------------------------------------
// Date ranges for analytics ("today", "last week", …) in the restaurant tz.
// Ranges are half-open [from, to).
// ---------------------------------------------------------------------------

export const RANGE_PRESETS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_month",
  "last_month",
  "custom",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface ResolvedRange {
  from: string; // ISO
  to: string; // ISO (exclusive)
  fromDate: string; // YYYY-MM-DD (inclusive)
  toDate: string; // YYYY-MM-DD (inclusive)
  label: string;
  days: number;
}

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function rangeFromDates(fromDate: string, toDateInclusive: string, tz = DEFAULT_TZ, now = new Date()): ResolvedRange {
  const from = startOfZonedDay(fromDate, tz);
  let to = startOfZonedDay(addDays(toDateInclusive, 1), tz);
  // Never extend into the future beyond "now" for partial current periods.
  if (to.getTime() > now.getTime() && from.getTime() <= now.getTime()) to = new Date(Math.min(to.getTime(), now.getTime() + 60_000));
  const days = Math.round((startOfZonedDay(addDays(toDateInclusive, 1), tz).getTime() - from.getTime()) / 86_400_000);
  const label =
    fromDate === toDateInclusive ? `${dayLabel(fromDate)} (IST)` : `${dayLabel(fromDate)} – ${dayLabel(toDateInclusive)} (IST)`;
  return { from: from.toISOString(), to: to.toISOString(), fromDate, toDate: toDateInclusive, label, days };
}

export function resolveRange(
  preset: RangePreset = "last_7_days",
  custom?: { from?: string; to?: string },
  tz = DEFAULT_TZ,
  now = new Date(),
): ResolvedRange {
  const today = zonedDateString(now, tz);
  const p = zonedParts(now, tz);
  const mondayOffset = (p.weekday + 6) % 7; // days since Monday
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "today":
      return rangeFromDates(today, today, tz, now);
    case "yesterday": {
      const y = addDays(today, -1);
      return rangeFromDates(y, y, tz, now);
    }
    case "this_week":
      return rangeFromDates(addDays(today, -mondayOffset), today, tz, now);
    case "last_week": {
      const start = addDays(today, -mondayOffset - 7);
      return rangeFromDates(start, addDays(start, 6), tz, now);
    }
    case "last_30_days":
      return rangeFromDates(addDays(today, -29), today, tz, now);
    case "last_90_days":
      return rangeFromDates(addDays(today, -89), today, tz, now);
    case "this_month":
      return rangeFromDates(monthStart, today, tz, now);
    case "last_month": {
      const [y, m] = monthStart.split("-").map(Number);
      const prevStart = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
      return rangeFromDates(prevStart, addDays(monthStart, -1), tz, now);
    }
    case "custom": {
      if (!custom?.from) return rangeFromDates(addDays(today, -6), today, tz, now);
      return rangeFromDates(custom.from, custom.to ?? custom.from, tz, now);
    }
    case "last_7_days":
    default:
      return rangeFromDates(addDays(today, -6), today, tz, now);
  }
}

/** The equivalent previous period of the same length (for comparisons). */
export function previousPeriod(r: ResolvedRange, tz = DEFAULT_TZ): ResolvedRange {
  const len = r.days;
  const toDate = addDays(r.fromDate, -1);
  return rangeFromDates(addDays(toDate, -(len - 1)), toDate, tz, new Date(8640000000000000));
}

export function formatDateTime(iso: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}
