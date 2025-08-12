import { NextResponse } from "next/server";
import { withApi } from "../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../lib/config";
import { latestCompleteIsoWeek, backfillIsoWeeks } from "../../../lib/week";
import { loadPromosFromData, computeUpliftSeries, type UpliftPoint } from "../../../lib/promo";

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

function parseList(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const arr = v.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week");
  const weeksParam = url.searchParams.get("weeks");
  const baselineParam = url.searchParams.get("baselineWeeks");
  const yearsParam = url.searchParams.get("years");
  const skuUpcs = parseList(url.searchParams.get("skuUpcs"));
  const storeCodes = parseList(url.searchParams.get("storeCodes"));

  const endIso = weekParam ?? latestCompleteIsoWeek();
  const weeks = Number.isFinite(Number(weeksParam)) ? Math.max(1, Math.min(52, Number(weeksParam))) : 12;
  const baselineWeeks = Number.isFinite(Number(baselineParam)) ? Math.max(1, Math.min(26, Number(baselineParam))) : 4;
  const years = yearsParam
    ? yearsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n))
    : [2024, 2025];

  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  const promos = loadPromosFromData(years);

  if (!useDb) {
    // Demo: simulate uplift based on promo-active weeks
    const isoWindow = backfillIsoWeeks(endIso, weeks);
    const activeWeeks = new Set<string>();
    // mark weeks touched by any promo
    for (const p of promos) {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      // naive week coverage by date list -> iso weeks
      const days: string[] = [];
      const s = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const e = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(
          (() => {
            const dd = new Date(d);
            const day = dd.getUTCDay() || 7;
            dd.setUTCDate(dd.getUTCDate() + 4 - day);
            const yearStart = new Date(Date.UTC(dd.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil(((+dd - +yearStart) / 86400000 + 1) / 7);
            const yy = dd.getUTCFullYear();
            const ww = String(weekNo).padStart(2, "0");
            return `${yy}-W${ww}`;
          })()
        );
      }
      for (const w of new Set(days)) activeWeeks.add(w);
    }

    const points: UpliftPoint[] = isoWindow.map((iso, idx) => {
      const base = 100000 + idx * 3000; // rising baseline
      const wobble = Math.sin(idx / 2) * 2500;
      const promoActive = activeWeeks.has(iso);
      const effect = promoActive ? 0.18 : 0.0; // +18% uplift during promos
      const baseline = Math.round(base);
      const revenue = Math.max(0, Math.round((base + wobble) * (1 + effect)));
      const upliftPct = baseline > 0 && promoActive ? Number((((revenue - baseline) / baseline) * 100).toFixed(1)) : 0;
      return { isoWeek: iso, revenue, baseline, upliftPct, promoActive };
    });

    return NextResponse.json(points);
  }

  // Live: compute from DB facts; filters optional
  const points = await computeUpliftSeries(endIso, weeks, baselineWeeks, promos, { skuUpcs, storeCodes });
  return NextResponse.json(points);
});
