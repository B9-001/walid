// Operating hours for Diamond Taste (Abuja — West Africa Time, UTC+1, no DST).
// The shop opens/closes on a weekly schedule. Orders placed while closed (or for a
// later day) become pre-orders fulfilled on the chosen open day. All "now" maths is
// done in the Africa/Lagos wall clock so it's correct regardless of the visitor's
// own device timezone.

export type DayHours = { open: string; close: string }; // "HH:MM" 24h
export type BusinessHours = Record<string, DayHours | null>; // keys: Mon..Sun

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  Mon: { open: "10:00", close: "19:00" },
  Tue: { open: "10:00", close: "19:00" },
  Wed: { open: "10:00", close: "19:00" },
  Thu: { open: "10:00", close: "19:00" },
  Fri: { open: "10:00", close: "19:00" },
  Sat: { open: "10:00", close: "19:00" },
  Sun: { open: "10:00", close: "19:00" },
};

const TZ = "Africa/Lagos";
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // JS getUTCDay order
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Civil = { y: number; m: number; d: number; dow: number };

const toMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function timeLabel(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
}

const isoDate = (c: { y: number; m: number; d: number }): string =>
  `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;

// Current wall-clock in Abuja.
function watNow(now: Date): { date: Civil; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get("year"), m = get("month"), d = get("day");
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit 24 at midnight
  const minute = get("minute");
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { date: { y, m, d, dow }, minutes: hour * 60 + minute };
}

function addDays(base: Civil, n: number): Civil {
  const dt = new Date(Date.UTC(base.y, base.m - 1, base.d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() };
}

function dayLabel(c: Civil, today: Civil): string {
  const iso = isoDate(c);
  if (iso === isoDate(today)) return "Today";
  if (iso === isoDate(addDays(today, 1))) return "Tomorrow";
  return `${WEEKDAYS[c.dow]}, ${c.d} ${MONTHS[c.m - 1]}`;
}

const hoursFor = (hours: BusinessHours, dow: number): DayHours | null => hours[DAY_KEYS[dow]] ?? null;

export type ShopStatus = {
  isOpen: boolean;
  closesAtLabel: string | null;   // today's closing time when open, e.g. "7 PM"
  opensTodayAtLabel: string | null; // set when closed now but reopening later today
  earliestDate: string;           // ISO yyyy-mm-dd of the soonest fulfilment day
  earliestLabel: string;          // "Today" | "Tomorrow" | "Friday, 13 Jun"
  earliestIsToday: boolean;
  statusMessage: string;
  // Selectable fulfilment days (soonest first) for the pre-order picker.
  options: { date: string; label: string; openLabel: string }[];
};

export function getShopStatus(
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  now: Date = new Date()
): ShopStatus {
  const { date: today, minutes } = watNow(now);
  const todayHours = hoursFor(hours, today.dow);
  const isOpen = !!todayHours && minutes >= toMin(todayHours.open) && minutes < toMin(todayHours.close);

  // The soonest day we can fulfil: today if there's still open time left today,
  // otherwise the next day that has opening hours.
  let earliest: Civil;
  let opensTodayAtLabel: string | null = null;
  if (todayHours && minutes < toMin(todayHours.close)) {
    earliest = today;
    if (minutes < toMin(todayHours.open)) opensTodayAtLabel = timeLabel(toMin(todayHours.open));
  } else {
    earliest = today;
    for (let i = 1; i <= 7; i++) {
      const cand = addDays(today, i);
      if (hoursFor(hours, cand.dow)) { earliest = cand; break; }
    }
  }

  // Build up to 14 days of selectable open days from the earliest onward.
  const options: ShopStatus["options"] = [];
  for (let i = 0; i < 14 && options.length < 8; i++) {
    const cand = addDays(earliest, i);
    const ch = hoursFor(hours, cand.dow);
    if (!ch) continue;
    options.push({ date: isoDate(cand), label: dayLabel(cand, today), openLabel: `${timeLabel(toMin(ch.open))}–${timeLabel(toMin(ch.close))}` });
  }

  const closesAtLabel = isOpen && todayHours ? timeLabel(toMin(todayHours.close)) : null;
  const earliestHours = hoursFor(hours, earliest.dow);
  const earliestOpen = earliestHours ? timeLabel(toMin(earliestHours.open)) : "";

  let statusMessage: string;
  if (isOpen) statusMessage = `We're open now until ${closesAtLabel}.`;
  else if (opensTodayAtLabel) statusMessage = `We're closed right now — we open today at ${opensTodayAtLabel}.`;
  else statusMessage = `We're closed right now — we reopen ${dayLabel(earliest, today)} at ${earliestOpen}.`;

  return {
    isOpen,
    closesAtLabel,
    opensTodayAtLabel,
    earliestDate: isoDate(earliest),
    earliestLabel: dayLabel(earliest, today),
    earliestIsToday: isoDate(earliest) === isoDate(today),
    statusMessage,
    options,
  };
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Today's date (Abuja) as YYYY-MM-DD.
export function watTodayISO(now: Date = new Date()): string {
  return isoDate(watNow(now).date);
}

// Shift a YYYY-MM-DD string by n days.
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(addDays({ y, m, d, dow: 0 }, n));
}

// Opening hours for a specific calendar date (null = closed that day).
export function dayHoursFor(hours: BusinessHours, dateISO: string): DayHours | null {
  const [y, m, d] = dateISO.split("-").map(Number);
  if (!y || !m || !d) return null;
  return hoursFor(hours, new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

export function isOpenDay(hours: BusinessHours, dateISO: string): boolean {
  return !!dayHoursFor(hours, dateISO);
}

// Selectable delivery time slots inside a day's opening window. For the current
// day, pass afterNow to drop slots that have already passed.
export function daySlots(
  hours: BusinessHours,
  dateISO: string,
  opts: { afterNow?: boolean; now?: Date; stepMin?: number } = {}
): { value: string; label: string }[] {
  const dh = dayHoursFor(hours, dateISO);
  if (!dh) return [];
  const step = opts.stepMin ?? 60;
  const open = toMin(dh.open);
  const close = toMin(dh.close);
  let start = open;
  if (opts.afterNow) {
    const { date, minutes } = watNow(opts.now ?? new Date());
    if (isoDate(date) === dateISO) start = Math.max(open, Math.ceil((minutes + 1) / step) * step);
  }
  const slots: { value: string; label: string }[] = [];
  for (let t = start; t <= close - step; t += step) slots.push({ value: hhmm(t), label: timeLabel(t) });
  return slots;
}

// "Today" / "Tomorrow" / "Monday, 9 June" for a YYYY-MM-DD date.
export function formatDateLabel(dateISO: string, now: Date = new Date()): string {
  const today = watTodayISO(now);
  if (dateISO === today) return "Today";
  if (dateISO === addDaysISO(today, 1)) return "Tomorrow";
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}
