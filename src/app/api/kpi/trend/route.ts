import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { withApi } from "../../../../../lib/api";
import { DEMO_MODE as ENV_DEMO_MODE, USE_DB as ENV_USE_DB } from "../../../../lib/config";

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

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? ENV_DEMO_MODE;
  const useDb = ENV_USE_DB && !demoMode;

  if (!useDb) {
    // Demo mode or DB disabled: return synthetic trend
    const demo = generateDemoTrend(weeks);
    return NextResponse.json(demo);
  }

  const weeksList = await prisma.week.findMany({
    orderBy: { startDate: "desc" },
    take: weeks,
    select: { id: true, iso: true, startDate: true },
  });

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
