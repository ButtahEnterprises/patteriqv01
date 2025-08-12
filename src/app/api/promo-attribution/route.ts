import { NextResponse } from "next/server";
import { withApi } from "../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../lib/config";
import { loadPromosFromData, computeLiveAttributionForPromo, type PromoAttributionItem } from "../../../lib/promo";

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

function hashToRange(id: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const t = (h >>> 0) / 0xffffffff;
  return min + (max - min) * t;
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const yearsParam = url.searchParams.get("years");
  const baselineParam = url.searchParams.get("baselineWeeks");
  const years = yearsParam
    ? yearsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n))
    : [2024, 2025];
  const baselineWeeks = (() => {
    const n = baselineParam ? parseInt(baselineParam, 10) : 4;
    return Number.isFinite(n) ? Math.max(1, Math.min(26, n)) : 4;
  })();

  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  const promos = loadPromosFromData(years);

  if (!useDb) {
    // Demo attribution: derive deterministic baseline/effect and compute delta/halo
    const items: PromoAttributionItem[] = promos.map((p) => {
      const baselineAvg = Math.round(hashToRange(p.id + "b", 90000, 160000));
      const effect = hashToRange(p.id + "e", -20, 35); // -20..+35%
      const promoAvg = Math.round(baselineAvg * (1 + effect / 100));
      // Count promo weeks by unique ISO week keys over the date span
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      const isoWeeks = new Set<string>();
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        const day = x.getUTCDay() || 7;
        x.setUTCDate(x.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((+x - +yearStart) / 86400000 + 1) / 7);
        const ww = String(weekNo).padStart(2, "0");
        isoWeeks.add(`${x.getUTCFullYear()}-W${ww}`);
      }
      const weeks = Array.from(isoWeeks).sort().map((iso, idx) => {
        const wobble = Math.sin(idx / 2) * (baselineAvg * 0.05);
        return { isoWeek: iso, revenue: Math.max(0, Math.round(promoAvg + wobble)) };
      });
      const promoWeekCount = weeks.length || 1;
      const deltaRevenue = weeks.reduce((a, b) => a + b.revenue, 0) - baselineAvg * promoWeekCount;
      const nonTargetEffectPct = Number((hashToRange(p.id + "h", -8, 12)).toFixed(1));
      return {
        ...p,
        metrics: { baselineAvg, promoAvg, effectPct: Number(effect.toFixed(1)) },
        deltaRevenue: Number(deltaRevenue.toFixed(2)),
        weeks,
        targetSkuCount: p.skuUpcs?.length ?? 0,
        halo: { nonTargetEffectPct },
      } satisfies PromoAttributionItem;
    });
    return NextResponse.json(items);
  }

  const items: PromoAttributionItem[] = [];
  for (const p of promos) {
    const it = await computeLiveAttributionForPromo(p, baselineWeeks);
    items.push(it);
  }
  return NextResponse.json(items);
});
