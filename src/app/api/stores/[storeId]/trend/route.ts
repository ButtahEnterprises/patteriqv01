import { NextResponse } from "next/server";
import prisma from "../../../../../../lib/prisma";
import { withApi } from "../../../../../../lib/api";
import { DEMO_MODE as ENV_DEMO_MODE, USE_DB as ENV_USE_DB } from "../../../../../lib/config";

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

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? ENV_DEMO_MODE;
  const useDb = ENV_USE_DB && !demoMode;

  if (!useDb) {
    const demo = generateDemoTrend(weeks, storeId);
    return NextResponse.json(demo);
  }

  const recentWeeks = await prisma.week.findMany({
    orderBy: { startDate: "desc" },
    take: weeks,
    select: { id: true, iso: true, startDate: true },
  });

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
