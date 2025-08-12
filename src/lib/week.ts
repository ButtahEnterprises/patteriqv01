// Shared ISO week utilities
// All computations use UTC to avoid timezone drift between server and client.

export function toISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // 1..7, Monday=1
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  const yy = d.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yy}-W${ww}`;
}

export function parseIsoWeek(iso: string): { year: number; week: number } | null {
  const m = /^([0-9]{4})-W([0-9]{2})$/i.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  return { year, week };
}

export function mondayOfISOWeek(year: number, week: number): Date {
  // ISO week 1 is the week with the year's first Thursday. Monday is day 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1..7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function addWeeksUTC(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d;
}

export function shiftIsoWeek(iso: string, deltaWeeks: number): string {
  const parsed = parseIsoWeek(iso);
  if (!parsed) return iso;
  const base = mondayOfISOWeek(parsed.year, parsed.week);
  const shifted = addWeeksUTC(base, deltaWeeks);
  return toISOWeekKey(shifted);
}

export function latestCompleteIsoWeek(now: Date = new Date()): string {
  // Compute Monday of current ISO week, then go back one week to get the last completed week.
  const day = (now.getUTCDay() || 7) - 1; // 0..6, Monday=0
  const startOfThisISOWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startOfThisISOWeek.setUTCDate(startOfThisISOWeek.getUTCDate() - day);
  const prevWeekMonday = addWeeksUTC(startOfThisISOWeek, -1);
  return toISOWeekKey(prevWeekMonday);
}

export function backfillIsoWeeks(endIso: string, weeks: number): string[] {
  const parsed = parseIsoWeek(endIso);
  if (!parsed) return [];
  const endMonday = mondayOfISOWeek(parsed.year, parsed.week);
  const out: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = addWeeksUTC(endMonday, -i);
    out.push(toISOWeekKey(d));
  }
  return out;
}
