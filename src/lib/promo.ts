// src/lib/promo.ts
// Helpers for aligning promotions to ISO weeks and computing uplift series.
// Keeps logic isolated from routes for easier unit testing.

import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { toISOWeekKey, parseIsoWeek, mondayOfISOWeek, addWeeksUTC, backfillIsoWeeks } from "./week";

export type PromoJson = {
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

export type UpliftPoint = {
  isoWeek: string;
  revenue: number;
  baseline: number;
  upliftPct: number; // percentage -100..+
  promoActive: boolean;
};

export type PromoAttributionItem = PromoJson & {
  metrics: {
    baselineAvg: number;
    promoAvg: number;
    effectPct: number; // promo vs baseline percent change
  };
  deltaRevenue: number; // sum(promo) - baselineAvg * promoWeekCount
  weeks: Array<{ isoWeek: string; revenue: number }>;
  targetSkuCount: number;
  halo: {
    nonTargetEffectPct: number; // halo across SKUs not in target list
  };
};

export function loadPromosFromData(years: number[]): PromoJson[] {
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
  out.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return out;
}

export function isoWeeksForRange(startDate: Date, endDate: Date): string[] {
  const days: string[] = [];
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(toISOWeekKey(d));
  }
  return Array.from(new Set(days));
}

export function promoActiveIsoWeeks(promos: PromoJson[]): Set<string> {
  const set = new Set<string>();
  for (const p of promos) {
    const ws = isoWeeksForRange(new Date(p.startDate), new Date(p.endDate));
    for (const w of ws) set.add(w);
  }
  return set;
}

export async function weekIdsForIsoWeeks(isoWeeks: string[]): Promise<Map<string, number>> {
  if (isoWeeks.length === 0) return new Map();
  const rows = await prisma.week.findMany({
    where: { iso: { in: isoWeeks } },
    select: { id: true, iso: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.iso, r.id);
  return map;
}

export async function revenueByIsoWeek(
  isoWeeks: string[],
  opts?: { skuIds?: number[]; storeIds?: number[] }
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = await weekIdsForIsoWeeks(isoWeeks);
  const weekIds = Array.from(ids.values());
  if (weekIds.length === 0) return map;
  const where: Prisma.SalesFactWhereInput = {
    weekId: { in: weekIds },
    ...(opts?.skuIds && opts.skuIds.length ? { skuId: { in: opts.skuIds } } : {}),
    ...(opts?.storeIds && opts.storeIds.length ? { storeId: { in: opts.storeIds } } : {}),
  };
  const grouped = await prisma.salesFact.groupBy({ by: ["weekId"], where, _sum: { revenue: true } });
  const idToIso = new Map<string, string>();
  for (const [iso, id] of ids.entries()) idToIso.set(String(id), iso);
  for (const g of grouped as Array<{ weekId: number; _sum: { revenue: Prisma.Decimal | number | null } }>) {
    const iso = idToIso.get(String(g.weekId));
    if (!iso) continue;
    map.set(iso, g._sum.revenue ? Number(g._sum.revenue) : 0);
  }
  // Ensure all isoWeeks appear (fill zero)
  for (const w of isoWeeks) if (!map.has(w)) map.set(w, 0);
  return map;
}

export function computeBaselineMap(
  isoWeeks: string[],
  revenue: Map<string, number>,
  baselineSpan: number
): Map<string, number> {
  const base = new Map<string, number>();
  for (let i = 0; i < isoWeeks.length; i++) {
    const cur = isoWeeks[i];
    const prev = isoWeeks.slice(Math.max(0, i - baselineSpan), i);
    if (prev.length === 0) {
      base.set(cur, revenue.get(cur) ?? 0);
    } else {
      const vals = prev.map((w) => revenue.get(w) ?? 0);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      base.set(cur, avg);
    }
  }
  return base;
}

export async function computeUpliftSeries(
  endIsoWeek: string,
  windowWeeks: number,
  baselineSpan: number,
  promos: PromoJson[],
  opts?: { skuUpcs?: string[]; storeCodes?: string[] }
): Promise<UpliftPoint[]> {
  const parsed = parseIsoWeek(endIsoWeek);
  if (!parsed) return [];
  const endMonday = mondayOfISOWeek(parsed.year, parsed.week);
  const isoWindow = backfillIsoWeeks(endIsoWeek, windowWeeks);

  // Mark promo-active iso weeks within the window
  const activeSetAll = promoActiveIsoWeeks(promos);
  const activeInWindow = new Set<string>(isoWindow.filter((w) => activeSetAll.has(w)));

  // Optional filters
  let skuIds: number[] | undefined;
  let storeIds: number[] | undefined;
  if (opts?.skuUpcs && opts.skuUpcs.length) {
    const skus = await prisma.sku.findMany({ where: { upc: { in: opts.skuUpcs } }, select: { id: true } });
    skuIds = skus.map((s) => s.id);
  }
  if (opts?.storeCodes && opts.storeCodes.length) {
    const stores = await prisma.store.findMany({ where: { code: { in: opts.storeCodes } }, select: { id: true } });
    storeIds = stores.map((s) => s.id);
  }

  const revMap = await revenueByIsoWeek(isoWindow, { skuIds, storeIds });
  const baseMap = computeBaselineMap(isoWindow, revMap, baselineSpan);

  const points: UpliftPoint[] = isoWindow.map((iso) => {
    const revenue = revMap.get(iso) ?? 0;
    const baseline = baseMap.get(iso) ?? 0;
    const promoActive = activeInWindow.has(iso);
    const upliftPct = baseline > 0 && promoActive ? ((revenue - baseline) / baseline) * 100 : 0;
    return { isoWeek: iso, revenue, baseline, upliftPct: Number(upliftPct.toFixed(1)), promoActive };
  });

  return points;
}

export async function computeLiveAttributionForPromo(
  p: PromoJson,
  baselineWeeksCount: number,
): Promise<PromoAttributionItem> {
  const start = new Date(p.startDate);
  const end = new Date(p.endDate);

  const weeksInRange = await prisma.week.findMany({
    where: { startDate: { gte: start, lte: end } },
    select: { id: true, iso: true, startDate: true },
    orderBy: { startDate: "asc" },
  });

  const baselineWeeks = await prisma.week.findMany({
    where: { startDate: { lt: start } },
    select: { id: true, iso: true, startDate: true },
    orderBy: { startDate: "desc" },
    take: Math.max(1, Math.min(26, baselineWeeksCount)),
  });

  const promoWeekIds = weeksInRange.map((w) => w.id);
  const baselineWeekIds = baselineWeeks.map((w) => w.id);

  let targetSkuIds: number[] | undefined;
  if (p.skuUpcs && p.skuUpcs.length) {
    const skus = await prisma.sku.findMany({ where: { upc: { in: p.skuUpcs } }, select: { id: true } });
    targetSkuIds = skus.map((s) => s.id);
  }

  // Target SKU revenue
  const promoSumTargets = promoWeekIds.length
    ? await prisma.salesFact.groupBy({
        by: ["weekId"],
        where: {
          weekId: { in: promoWeekIds },
          ...(targetSkuIds && targetSkuIds.length ? { skuId: { in: targetSkuIds } } : {}),
        },
        _sum: { revenue: true },
      })
    : [];

  const baseSumTargets = baselineWeekIds.length
    ? await prisma.salesFact.groupBy({
        by: ["weekId"],
        where: {
          weekId: { in: baselineWeekIds },
          ...(targetSkuIds && targetSkuIds.length ? { skuId: { in: targetSkuIds } } : {}),
        },
        _sum: { revenue: true },
      })
    : [];

  const promoMap = new Map<number, number>();
  for (const g of promoSumTargets as Array<{ weekId: number; _sum: { revenue: Prisma.Decimal | number | null } }>) {
    promoMap.set(g.weekId, g._sum.revenue ? Number(g._sum.revenue) : 0);
  }
  const baseMap = new Map<number, number>();
  for (const g of baseSumTargets as Array<{ weekId: number; _sum: { revenue: Prisma.Decimal | number | null } }>) {
    baseMap.set(g.weekId, g._sum.revenue ? Number(g._sum.revenue) : 0);
  }

  const promoVals = weeksInRange.map((w) => promoMap.get(w.id) ?? 0);
  const baseVals = baselineWeeks.map((w) => baseMap.get(w.id) ?? 0);

  const promoAvg = promoVals.length ? promoVals.reduce((a, b) => a + b, 0) / promoVals.length : 0;
  const baselineAvg = baseVals.length ? baseVals.reduce((a, b) => a + b, 0) / baseVals.length : 0;
  const effectPct = baselineAvg > 0 ? ((promoAvg - baselineAvg) / baselineAvg) * 100 : 0;
  const deltaRevenue = promoVals.reduce((a, b) => a + b, 0) - baselineAvg * Math.max(1, promoVals.length);

  const weeks = weeksInRange.map((w) => ({ isoWeek: w.iso, revenue: promoMap.get(w.id) ?? 0 }));

  // Halo across non-target SKUs (if there is a target set)
  let nonTargetEffectPct = 0;
  if (targetSkuIds && targetSkuIds.length) {
    const promoSumNonTargets = promoWeekIds.length
      ? await prisma.salesFact.groupBy({
          by: ["weekId"],
          where: {
            weekId: { in: promoWeekIds },
            skuId: { notIn: targetSkuIds },
          },
          _sum: { revenue: true },
        })
      : [];
    const baseSumNonTargets = baselineWeekIds.length
      ? await prisma.salesFact.groupBy({
          by: ["weekId"],
          where: {
            weekId: { in: baselineWeekIds },
            skuId: { notIn: targetSkuIds },
          },
          _sum: { revenue: true },
        })
      : [];

    const promoNonVals = promoSumNonTargets.map((g) => (g._sum.revenue ? Number(g._sum.revenue) : 0));
    const baseNonVals = baseSumNonTargets.map((g) => (g._sum.revenue ? Number(g._sum.revenue) : 0));
    const promoNonAvg = promoNonVals.length ? promoNonVals.reduce((a, b) => a + b, 0) / promoNonVals.length : 0;
    const baseNonAvg = baseNonVals.length ? baseNonVals.reduce((a, b) => a + b, 0) / baseNonVals.length : 0;
    nonTargetEffectPct = baseNonAvg > 0 ? ((promoNonAvg - baseNonAvg) / baseNonAvg) * 100 : 0;
  }

  return {
    ...p,
    metrics: { baselineAvg, promoAvg, effectPct: Number(effectPct.toFixed(1)) },
    deltaRevenue: Number(deltaRevenue.toFixed(2)),
    weeks,
    targetSkuCount: targetSkuIds?.length ?? 0,
    halo: { nonTargetEffectPct: Number(nonTargetEffectPct.toFixed(1)) },
  };
}
