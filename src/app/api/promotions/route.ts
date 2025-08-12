import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { withApi } from "../../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../lib/config";
import type { Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_COOKIE = "piq_demo_mode";
const TEST_FAIL_COOKIE = "piq_test_error_promotions";

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

function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

function toISOWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // 1..7, Monday=1
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  const yy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yy}-W${ww}`;
}

function hashToRange(id: string, min: number, max: number): number {
  // simple deterministic hash -> [min,max]
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const t = (h >>> 0) / 0xffffffff;
  return min + (max - min) * t;
}

type PromoJson = {
  id: string;
  name: string;
  description?: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
  type?: string;
  tags?: string[];
  skuUpcs?: string[];
  status?: "confirmed" | "tentative";
};

type PromoApiItem = PromoJson & {
  metrics: {
    baselineAvg: number;
    promoAvg: number;
    effectPct: number; // -100..+inf
  };
  weeks: Array<{ isoWeek: string; revenue: number }>;
};

async function loadDemoPromos(years: number[]): Promise<PromoJson[]> {
  const base = path.join(process.cwd(), "data", "promotions");
  const out: PromoJson[] = [];
  for (const y of years) {
    const fp = path.join(base, `promotions_${y}.json`);
    if (fs.existsSync(fp)) {
      const raw = fs.readFileSync(fp, "utf-8");
      const arr = JSON.parse(raw) as PromoJson[];
      out.push(...arr);
    }
  }
  // sort by startDate asc
  out.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return out;
}

async function computeLiveForPromo(p: PromoJson, baselineWeeksCount: number): Promise<PromoApiItem> {
  const start = new Date(p.startDate);
  const end = new Date(p.endDate);

  // Weeks fully in range (use week.startDate within [start,end])
  const weeksInRange = await prisma.week.findMany({
    where: { startDate: { gte: start, lte: end } },
    select: { id: true, iso: true, startDate: true },
    orderBy: { startDate: "asc" },
  });

  // Baseline: prior N weeks before start (default 4)
  const baselineWeekRows = await prisma.week.findMany({
    where: { startDate: { lt: start } },
    select: { id: true, iso: true, startDate: true },
    orderBy: { startDate: "desc" },
    take: Math.max(1, Math.min(26, baselineWeeksCount)),
  });

  const promoWeekIds = weeksInRange.map((w) => w.id);
  const baselineWeekIds = baselineWeekRows.map((w) => w.id);

  // Optional SKU filter
  let skuIds: number[] | undefined;
  if (p.skuUpcs && p.skuUpcs.length) {
    const skus = await prisma.sku.findMany({ where: { upc: { in: p.skuUpcs } }, select: { id: true } });
    skuIds = skus.map((s) => s.id);
  }

  const promoSum = promoWeekIds.length
    ? await prisma.salesFact.groupBy({
        by: ["weekId"],
        where: {
          weekId: { in: promoWeekIds },
          ...(skuIds && skuIds.length ? { skuId: { in: skuIds } } : {}),
        },
        _sum: { revenue: true },
      })
    : [];

  const baseSum = baselineWeekIds.length
    ? await prisma.salesFact.groupBy({
        by: ["weekId"],
        where: {
          weekId: { in: baselineWeekIds },
          ...(skuIds && skuIds.length ? { skuId: { in: skuIds } } : {}),
        },
        _sum: { revenue: true },
      })
    : [];

  const promoMap = new Map<number, number>();
  for (const g of promoSum as Array<{ weekId: number; _sum: { revenue: Prisma.Decimal | number | null } }>) {
    promoMap.set(g.weekId, g._sum.revenue ? Number(g._sum.revenue) : 0);
  }
  const baseMap = new Map<number, number>();
  for (const g of baseSum as Array<{ weekId: number; _sum: { revenue: Prisma.Decimal | number | null } }>) {
    baseMap.set(g.weekId, g._sum.revenue ? Number(g._sum.revenue) : 0);
  }

  const promoVals = weeksInRange.map((w) => promoMap.get(w.id) ?? 0);
  const baseVals = baselineWeekRows.map((w) => baseMap.get(w.id) ?? 0);

  const promoAvg = promoVals.length ? promoVals.reduce((a, b) => a + b, 0) / promoVals.length : 0;
  const baselineAvg = baseVals.length ? baseVals.reduce((a, b) => a + b, 0) / baseVals.length : 0;
  const effectPct = baselineAvg > 0 ? ((promoAvg - baselineAvg) / baselineAvg) * 100 : 0;

  const weeks = weeksInRange.map((w) => ({ isoWeek: w.iso, revenue: promoMap.get(w.id) ?? 0 }));

  return {
    ...p,
    metrics: { baselineAvg, promoAvg, effectPct: Number(effectPct.toFixed(1)) },
    weeks,
  };
}

function simulateDemoForPromo(p: PromoJson): PromoApiItem {
  const start = new Date(p.startDate);
  const end = new Date(p.endDate);
  const isoWeeks = Array.from(
    new Set(getDatesInRange(start, end).map((d) => toISOWeekKey(d)))
  );
  const baseline = Math.round(hashToRange(p.id + "b", 90000, 160000));
  const effect = hashToRange(p.id + "e", -25, 40); // -25%..+40%
  const promoAvg = Math.round(baseline * (1 + effect / 100));
  const weeks = isoWeeks.map((iso, idx) => {
    const wobble = Math.sin(idx / 2) * (baseline * 0.05);
    const val = Math.max(0, Math.round(promoAvg + wobble));
    return { isoWeek: iso, revenue: val };
  });
  return {
    ...p,
    metrics: { baselineAvg: baseline, promoAvg, effectPct: Number(effect.toFixed(1)) },
    weeks,
  };
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const yearsParam = url.searchParams.get("years");
  const baselineParam = url.searchParams.get("baselineWeeks");
  const years = yearsParam
    ? yearsParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n))
    : [2024, 2025];
  const baselineWeeks = (() => {
    const n = baselineParam ? parseInt(baselineParam, 10) : 4;
    return Number.isFinite(n) ? Math.max(1, Math.min(26, n)) : 4;
  })();

  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  // Test-only error injection to validate UI error states via E2E.
  // Set cookie 'piq_test_error_promotions' to 'true' to force a 500.
  const forceError = parseBool(cookies[TEST_FAIL_COOKIE]);
  if (forceError) {
    return NextResponse.json({ error: "Injected promotions error (test only)" }, { status: 500 });
  }

  const promos = await loadDemoPromos(years);

  if (!useDb) {
    const items = promos.map(simulateDemoForPromo);
    // compute best/worst flags on client; keep API generic
    return NextResponse.json(items);
  }

  const items: PromoApiItem[] = [];
  for (const p of promos) {
    const it = await computeLiveForPromo(p, baselineWeeks);
    items.push(it);
  }
  return NextResponse.json(items);
});
