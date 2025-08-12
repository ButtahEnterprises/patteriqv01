import { NextResponse } from "next/server";
import prisma from "../../../../../../lib/prisma";
import { withApi } from "../../../../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../../../lib/config";

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

function isoFrom(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getStoreIdFromPath(pathname: string): number | null {
  // Expect: /api/stores/:storeId/trend
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("stores");
  if (idx >= 0 && parts.length > idx + 1) {
    const sid = Number.parseInt(parts[idx + 1], 10);
    return Number.isFinite(sid) ? sid : null;
  }
  return null;
}

function generateDemoTrend(weeks: number, seed: number): Array<{ isoWeek: string; revenue: number; units: number }> {
  const out: Array<{ isoWeek: string; revenue: number; units: number }> = [];
  const today = new Date();
  const phase = (seed % 7) / 7; // vary by store
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    const t = weeks - i;
    const revenue = Math.max(0, Math.round(60000 + t * 1200 + 8000 * Math.sin(i / 2.5 + phase)));
    const units = Math.max(0, Math.round(3500 + t * 20 + 300 * Math.cos(i / 3 + phase)));
    out.push({ isoWeek: isoFrom(d), revenue, units });
  }
  return out;
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const storeId = getStoreIdFromPath(pathname);
  if (!storeId) return NextResponse.json({ ok: false, error: "Invalid storeId" }, { status: 400 });

  const weeksParam = url.searchParams.get("weeks");
  let weeks = Number.parseInt(weeksParam ?? "8", 10);
  if (!Number.isFinite(weeks) || weeks <= 0) weeks = 8;
  weeks = Math.min(Math.max(weeks, 1), 104);
  const endWeekParam = url.searchParams.get("endWeek") || url.searchParams.get("week") || "latest";

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  if (!useDb) {
    // Support anchoring the synthetic trend
    function mondayOfISOWeek(year: number, week: number): Date {
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4Day = jan4.getUTCDay() || 7;
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
      const phase = (storeId % 7) / 7;
      for (let i = weeksCount - 1; i >= 0; i--) {
        const d = new Date(base);
        d.setUTCDate(base.getUTCDate() - (weeksCount - 1 - i) * 7);
        const t = weeksCount - i;
        const revenue = Math.max(0, Math.round(60000 + t * 1200 + 8000 * Math.sin(i / 2.5 + phase)));
        const units = Math.max(0, Math.round(3500 + t * 20 + 300 * Math.cos(i / 3 + phase)));
        out.push({ isoWeek: isoFrom(d), revenue, units });
      }
      return out;
    })(weeks, anchor);
    return NextResponse.json(demo);
  }

  // Determine end week for DB query
  let recentWeeks = [] as Array<{ id: number; iso: string; startDate: Date }>;
  if (!endWeekParam || endWeekParam === "latest") {
    recentWeeks = await prisma.week.findMany({
      orderBy: { startDate: "desc" },
      take: weeks,
      select: { id: true, iso: true, startDate: true },
    });
  } else if (/^\d{4}-W\d{2}$/i.test(endWeekParam)) {
    const target = await prisma.week.findFirst({ where: { iso: endWeekParam }, select: { startDate: true } });
    if (target) {
      recentWeeks = await prisma.week.findMany({
        where: { startDate: { lte: target.startDate } },
        orderBy: { startDate: "desc" },
        take: weeks,
        select: { id: true, iso: true, startDate: true },
      });
    } else {
      recentWeeks = await prisma.week.findMany({ orderBy: { startDate: "desc" }, take: weeks, select: { id: true, iso: true, startDate: true } });
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/i.test(endWeekParam)) {
    const d = new Date(endWeekParam);
    if (!isNaN(d.getTime())) {
      recentWeeks = await prisma.week.findMany({
        where: { startDate: { lte: d } },
        orderBy: { startDate: "desc" },
        take: weeks,
        select: { id: true, iso: true, startDate: true },
      });
    } else {
      recentWeeks = await prisma.week.findMany({ orderBy: { startDate: "desc" }, take: weeks, select: { id: true, iso: true, startDate: true } });
    }
  } else {
    recentWeeks = await prisma.week.findMany({ orderBy: { startDate: "desc" }, take: weeks, select: { id: true, iso: true, startDate: true } });
  }

  if (recentWeeks.length === 0) return NextResponse.json([]);

  const ordered = [...recentWeeks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const weekIds = ordered.map((w) => w.id);

  const sums = await prisma.salesFact.groupBy({
    by: ["weekId"],
    where: { weekId: { in: weekIds }, storeId },
    _sum: { revenue: true, units: true },
  });
  type SumRow = { weekId: number; _sum: { revenue: unknown; units: unknown } };
  const map = new Map<number, { revenue: number; units: number }>();
  for (const s of sums as SumRow[]) {
    map.set(s.weekId, {
      revenue: s._sum.revenue != null ? Number(s._sum.revenue) : 0,
      units: s._sum.units != null ? Number(s._sum.units) : 0,
    });
  }

  const out = ordered.map((w) => {
    const agg = map.get(w.id) ?? { revenue: 0, units: 0 };
    return { isoWeek: w.iso, revenue: agg.revenue, units: agg.units };
  });

  return NextResponse.json(out);
});
