import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { withApi } from "../../../../lib/api";
import { DEMO_MODE as ENV_DEMO_MODE, USE_DB as ENV_USE_DB, RISK_THRESHOLD } from "../../../lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[], mu: number): number {
  if (arr.length === 0) return 0;
  const v = arr.reduce((acc, x) => acc + Math.pow(x - mu, 2), 0) / arr.length; // population sd
  return Math.sqrt(v);
}

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

function generateDemoStores(limit: number): Array<{ storeId: number; storeName: string; zScore: number; pctChange: number; topSkuCount: number }> {
  const names = [
    "Chicago #102",
    "Austin #207",
    "Seattle #331",
    "Denver #145",
    "Brooklyn #411",
    "San Jose #256",
    "Atlanta #189",
    "Phoenix #298",
    "Boston #173",
    "Nashville #222",
  ];
  const out = names.slice(0, Math.min(limit, names.length)).map((name, i) => {
    const z = -1.2 - 0.1 * i; // descending risk
    const pct = -0.25 - 0.02 * i;
    const sku = 3 + ((i * 2) % 5);
    return { storeId: 1000 + i, storeName: name, zScore: Number(z.toFixed(3)), pctChange: Number(pct.toFixed(3)), topSkuCount: sku };
  });
  return out;
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  let lookback = parseInt(url.searchParams.get("lookback") || String(RISK_THRESHOLD.lookbackWeeks), 10);
  let limit = parseInt(url.searchParams.get("limit") || "10", 10);
  lookback = Math.min(Math.max(lookback, 2), 52);
  limit = Math.min(Math.max(limit, 1), 100);

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? ENV_DEMO_MODE;
  const useDb = ENV_USE_DB && !demoMode;

  if (!useDb) {
    // Demo mode or DB disabled: return synthetic stores-at-risk list
    return NextResponse.json(generateDemoStores(limit));
  }

  // Fetch latest N weeks
  const recentWeeks = await prisma.week.findMany({
    orderBy: { startDate: "desc" },
    take: lookback,
    select: { id: true, iso: true, startDate: true },
  });
  if (recentWeeks.length < 2) return NextResponse.json([]);

  const weeksAsc = [...recentWeeks].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const weekIds = weeksAsc.map((w) => w.id);
  const last4WeekIds = weeksAsc.slice(-4).map((w) => w.id);

  // Revenue per store per week
  const storeWeek = await prisma.salesFact.groupBy({
    by: ["weekId", "storeId"],
    where: { weekId: { in: weekIds } },
    _sum: { revenue: true },
  });

  // Build store -> timeseries
  const storeIds = Array.from(new Set(storeWeek.map((g) => g.storeId)));
  const series = new Map<number, number[]>();
  for (const sid of storeIds) {
    series.set(sid, Array(weekIds.length).fill(0));
  }
  type StoreWeekRow = { weekId: number; storeId: number; _sum: { revenue: unknown } };
  for (const g of storeWeek as StoreWeekRow[]) {
    const idx = weekIds.indexOf(g.weekId);
    if (idx >= 0) {
      const arr = series.get(g.storeId)!;
      arr[idx] = g._sum.revenue != null ? Number(g._sum.revenue) : 0;
    }
  }

  // Distinct SKUs per store over last 4 weeks
  const skuGroups = await prisma.salesFact.groupBy({
    by: ["storeId", "skuId"],
    where: { weekId: { in: last4WeekIds }, OR: [{ units: { gt: 0 } }, { revenue: { gt: 0 } }] },
    _count: { _all: true },
  });
  const skuCountByStore = new Map<number, number>();
  for (const g of skuGroups) {
    skuCountByStore.set(g.storeId, (skuCountByStore.get(g.storeId) || 0) + 1);
  }

  // Fetch store names
  const stores = await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } });
  const nameById = new Map(stores.map((s) => [s.id, s.name]));

  const results: Array<{ storeId: number; storeName: string; zScore: number; pctChange: number; topSkuCount: number }> = [];

  for (const sid of storeIds) {
    const arr = series.get(sid)!;
    if (arr.length < 2) continue;

    const latest = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    const mu = mean(arr);
    const sd = stddev(arr, mu);
    const z = sd > 0 ? (latest - mu) / sd : 0;
    const dropVsMean = mu > 0 ? (latest - mu) / mu : 0; // negative when below mean
    const pctChange = prev > 0 ? (latest - prev) / prev : latest > 0 ? 1 : 0;

    const topSkuCount = skuCountByStore.get(sid) || 0;
    const passesSkuFilter = topSkuCount >= 3;
    const isRisk = z < RISK_THRESHOLD.zScore && dropVsMean <= -RISK_THRESHOLD.pctDrop;

    if (passesSkuFilter && isRisk) {
      results.push({
        storeId: sid,
        storeName: nameById.get(sid) || String(sid),
        zScore: Number(z.toFixed(3)),
        pctChange: Number(pctChange.toFixed(3)),
        topSkuCount,
      });
    }
  }

  results.sort((a, b) => a.zScore - b.zScore);
  return NextResponse.json(results.slice(0, limit));
});
