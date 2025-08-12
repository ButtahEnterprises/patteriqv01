import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { withApi } from "../../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../lib/config";
import { PSEUDO_UPC } from "../../../../lib/constants";

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

function generateDemoHealth(weeks: number): Array<{ isoWeek: string; totalStores: number; pseudoStores: number; pctFullAllocated: number }> {
  const out: Array<{ isoWeek: string; totalStores: number; pseudoStores: number; pctFullAllocated: number }> = [];
  const today = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    const baseStores = 120 + Math.round(10 * Math.sin(i / 2));
    const pseudo = Math.max(0, Math.round(20 - i + 3 * Math.cos(i / 3)));
    const totalStores = Math.max(0, baseStores);
    const pseudoStores = Math.min(totalStores, pseudo);
    const fully = Math.max(0, totalStores - pseudoStores);
    const pct = totalStores > 0 ? (fully / totalStores) * 100 : 0;
    out.push({ isoWeek: isoFrom(d), totalStores, pseudoStores, pctFullAllocated: Number(pct.toFixed(1)) });
  }
  return out;
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const weeksParam = url.searchParams.get("weeks");
  let weeks = Number.parseInt(weeksParam ?? "12", 10);
  if (!Number.isFinite(weeks) || weeks <= 0) weeks = 12;
  weeks = Math.min(Math.max(weeks, 1), 104);
  const wantObject = (() => {
    const fmt = (url.searchParams.get("format") || "").toLowerCase();
    const includeIssues = url.searchParams.get("includeIssues");
    if (fmt === "object") return true;
    if (includeIssues === "1" || includeIssues === "true") return true;
    return false;
  })();

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  if (!useDb) {
    const demo = generateDemoHealth(weeks);
    const issues: string[] = [];
    const THRESH = 90;
    for (const r of demo) {
      if ((r.totalStores ?? 0) === 0) issues.push(`No store totals found for week ${r.isoWeek}`);
      if ((r.pctFullAllocated ?? 0) < THRESH) issues.push(`Low allocation in week ${r.isoWeek}: ${r.pctFullAllocated.toFixed(1)}% (< ${THRESH}%)`);
      if ((r.pseudoStores ?? 0) > 0 && (r.pctFullAllocated ?? 0) < 100) issues.push(`Pseudo-UPC allocations present in week ${r.isoWeek}`);
    }
    return NextResponse.json(wantObject ? { data: demo, issues } : demo);
  }

  // Fetch latest N weeks (exclude future weeks)
  const now = new Date();
  const weeksList = await prisma.week.findMany({
    where: { startDate: { lte: now } },
    orderBy: { startDate: "desc" },
    take: weeks,
    select: { id: true, iso: true, startDate: true },
  });
  if (weeksList.length === 0) return NextResponse.json(wantObject ? { data: [], issues: [] as string[] } : []);

  const ordered = [...weeksList].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const results = await Promise.all(
    ordered.map(async (w) => {
      const totalStores = (
        await prisma.salesFact.findMany({
          where: { weekId: w.id },
          distinct: ["storeId"],
          select: { storeId: true },
        })
      ).length;

      const pseudoStores = (
        await prisma.salesFact.findMany({
          where: { weekId: w.id, sku: { upc: PSEUDO_UPC } },
          distinct: ["storeId"],
          select: { storeId: true },
        })
      ).length;

      const fully = Math.max(0, totalStores - pseudoStores);
      const pct = totalStores > 0 ? (fully / totalStores) * 100 : 0;
      return { isoWeek: w.iso, totalStores, pseudoStores, pctFullAllocated: Number(pct.toFixed(1)) };
    })
  );

  // Build issues/warnings list for UI visibility (non-blocking)
  const issues: string[] = [];
  const THRESH = 90;
  for (const r of results) {
    if ((r.totalStores ?? 0) === 0) {
      issues.push(`No store totals found for week ${r.isoWeek}`);
    }
    if ((r.pctFullAllocated ?? 0) < THRESH) {
      issues.push(`Low allocation in week ${r.isoWeek}: ${r.pctFullAllocated.toFixed(1)}% (< ${THRESH}%)`);
    }
    if ((r.pseudoStores ?? 0) > 0 && (r.pctFullAllocated ?? 0) < 100) {
      issues.push(`Pseudo-UPC allocations present in week ${r.isoWeek} — missing Sales_Inv_Perf data may be causing under-allocation`);
    }
  }

  return NextResponse.json(wantObject ? { data: results, issues } : results);
});
