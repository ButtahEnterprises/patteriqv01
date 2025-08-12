import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { withApi } from "../../../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../../lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_COOKIE = "piq_demo_mode";

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}

function toISOWeekKey(d: Date): string {
  // ISO week: Monday-based weeks, week 1 is the week with the year's first Thursday
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // 1..7, Monday=1
  date.setUTCDate(date.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  const yy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yy}-W${ww}`;
}

function generateDemoTrend(weeks: number): Array<{ isoWeek: string; revenue: number; units: number }> {
  const out: Array<{ isoWeek: string; revenue: number; units: number }> = [];
  const today = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    const t = weeks - i; // 1..weeks
    const revenue = Math.max(0, Math.round(180000 + t * 2500 + 15000 * Math.sin(i / 2.5)));
    const units = Math.max(0, Math.round(12000 + t * 50 + 600 * Math.cos(i / 3)));
    out.push({ isoWeek: toISOWeekKey(d), revenue, units });
  }
  return out;
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const weeksParam = url.searchParams.get("weeks");
  let weeks = Number.parseInt(weeksParam ?? "12", 10);
  if (!Number.isFinite(weeks) || weeks <= 0) weeks = 12;
  weeks = Math.min(Math.max(weeks, 1), 104);
  const endWeekParam = url.searchParams.get("endWeek") || url.searchParams.get("week") || "latest";

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  if (!useDb) {
    // Demo mode or DB disabled: return synthetic trend, anchored if an endWeek is provided
    function mondayOfISOWeek(year: number, week: number): Date {
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7; // 1..7
      const week1Mon = new Date(jan4);
      week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
      const d = new Date(week1Mon);
      d.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
      return d;
    }
    function parseIsoWeek(iso: string): { year: number; week: number } | null {
      const m = /^([0-9]{4})-W([0-9]{2})$/i.exec(iso.trim());
      if (!m) return null;
      const year = Number(m[1]);
      const week = Number(m[2]);
      if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
      return { year, week };
    }
    let anchor: Date | undefined;
    if (endWeekParam && endWeekParam !== "latest") {
      if (/^\d{4}-W\d{2}$/i.test(endWeekParam)) {
        const p = parseIsoWeek(endWeekParam);
        if (p) anchor = mondayOfISOWeek(p.year, p.week);
      } else if (/^\d{4}-\d{2}-\d{2}$/i.test(endWeekParam)) {
        const d = new Date(endWeekParam);
        if (!isNaN(d.getTime())) anchor = d;
      }
    }
    const demo = (function generate(weeksCount: number, endDate?: Date) {
      const out: Array<{ isoWeek: string; revenue: number; units: number }> = [];
      const base = endDate ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate())) : new Date();
      // Generate earliest -> latest so isoWeek is ascending
      for (let i = 0; i < weeksCount; i++) {
        const d = new Date(base);
        d.setUTCDate(base.getUTCDate() - (weeksCount - 1 - i) * 7);
        const t = i + 1; // progress through time
        const revenue = Math.max(0, Math.round(180000 + t * 2500 + 15000 * Math.sin(i / 2.5)));
        const units = Math.max(0, Math.round(12000 + t * 50 + 600 * Math.cos(i / 3)));
        out.push({ isoWeek: toISOWeekKey(d), revenue, units });
      }
      return out;
    })(weeks, anchor);
    return NextResponse.json(demo);
  }

  // Determine end week anchor for DB query
  let weeksList = [] as Array<{ id: number; iso: string; startDate: Date }>;
  if (!endWeekParam || endWeekParam === "latest") {
    weeksList = await prisma.week.findMany({
      orderBy: { startDate: "desc" },
      take: weeks,
      select: { id: true, iso: true, startDate: true },
    });
  } else if (/^\d{4}-W\d{2}$/i.test(endWeekParam)) {
    const target = await prisma.week.findFirst({ where: { iso: endWeekParam }, select: { startDate: true } });
    if (target) {
      weeksList = await prisma.week.findMany({
        where: { startDate: { lte: target.startDate } },
        orderBy: { startDate: "desc" },
        take: weeks,
        select: { id: true, iso: true, startDate: true },
      });
    } else {
      weeksList = await prisma.week.findMany({ orderBy: { startDate: "desc" }, take: weeks, select: { id: true, iso: true, startDate: true } });
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/i.test(endWeekParam)) {
    const d = new Date(endWeekParam);
    if (!isNaN(d.getTime())) {
      weeksList = await prisma.week.findMany({
        where: { startDate: { lte: d } },
        orderBy: { startDate: "desc" },
        take: weeks,
        select: { id: true, iso: true, startDate: true },
      });
    } else {
      weeksList = await prisma.week.findMany({ orderBy: { startDate: "desc" }, take: weeks, select: { id: true, iso: true, startDate: true } });
    }
  } else {
    weeksList = await prisma.week.findMany({ orderBy: { startDate: "desc" }, take: weeks, select: { id: true, iso: true, startDate: true } });
  }

  if (weeksList.length === 0) return NextResponse.json([]);

  const weekIds = weeksList.map((w) => w.id);
  const sums = await prisma.salesFact.groupBy({
    by: ["weekId"],
    where: { weekId: { in: weekIds } },
    _sum: { revenue: true, units: true },
  });
  type SumRow = { weekId: number; _sum: { revenue: unknown; units: unknown } };
  const sumMap = new Map<number, { revenue: number; units: number }>();
  for (const s of sums as SumRow[]) {
    sumMap.set(s.weekId, {
      revenue: s._sum.revenue != null ? Number(s._sum.revenue) : 0,
      units: s._sum.units != null ? Number(s._sum.units) : 0,
    });
  }

  const ordered = [...weeksList].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const out = ordered.map((w) => {
    const agg = sumMap.get(w.id) ?? { revenue: 0, units: 0 };
    return { isoWeek: w.iso, revenue: agg.revenue, units: agg.units };
  });

  return NextResponse.json(out);
});
