import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { demoWeeklySummary } from "../../../lib/demo";
import { withApi } from "../../../../lib/api";
import { DEFAULT_TENANT } from "../../../lib/config";
import { getDemoModeEnv, getUseDbEnv } from "../../../lib/config";
import { isoFromDate } from "../../../../lib/db/ingest_helpers";

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

export const GET = withApi(async (req: Request) => {
  // Resolve effective mode and DB usage
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "summary";
  const weekParam = url.searchParams.get("week") || "latest";

  if (!useDb) {
    // In Demo or when DB disabled, always return demo summary regardless of view
    return NextResponse.json(demoWeeklySummary);
  }

  // Resolve target week
  async function resolveWeek(): Promise<{ id: number; iso: string } | null> {
    if (!weekParam || weekParam === "latest") {
      return prisma.week.findFirst({ orderBy: { startDate: "desc" }, select: { id: true, iso: true } });
    }
    // ISO week format YYYY-Www
    if (/^\d{4}-W\d{2}$/.test(weekParam)) {
      const wk = await prisma.week.findFirst({ where: { iso: weekParam }, select: { id: true, iso: true } });
      if (wk) return wk;
    }
    // Date format YYYY-MM-DD → map to ISO week
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      const d = new Date(weekParam);
      if (!isNaN(d.getTime())) {
        // pick week whose startDate <= d <= endDate
        const wk = await prisma.week.findFirst({ where: { startDate: { lte: d }, endDate: { gte: d } }, select: { id: true, iso: true } });
        if (wk) return wk;
        // Fallback: resolve ISO week string from date to avoid timezone boundary issues
        const iso = isoFromDate(d);
        const wk2 = await prisma.week.findFirst({ where: { iso }, select: { id: true, iso: true } });
        if (wk2) return wk2;
      }
    }
    return prisma.week.findFirst({ orderBy: { startDate: "desc" }, select: { id: true, iso: true } });
  }

  const week = await resolveWeek();
  if (!week) {
    // No data yet, serve demo summary
    return NextResponse.json(demoWeeklySummary);
  }

  if (view === "facts") {
    const facts = await prisma.salesFact.findMany({
      where: { weekId: week.id },
      include: { store: true, sku: true },
    });
    const items = facts.map((f) => ({
      storeId: f.storeId,
      storeCode: f.store?.code ?? String(f.storeId),
      storeName: f.store?.name ?? f.store?.code ?? String(f.storeId),
      skuId: f.skuId,
      upc: f.sku?.upc ?? String(f.skuId),
      skuName: f.sku?.name ?? undefined,
      units: f.units,
      revenue: Number(f.revenue || 0),
    }));
    return NextResponse.json({ week: week.iso, items });
  }

  // Default: KPI summary for the selected week
  const agg = await prisma.salesFact.aggregate({ where: { weekId: week.id }, _sum: { revenue: true, units: true } });
  const skus = await prisma.salesFact.findMany({ where: { weekId: week.id }, select: { skuId: true }, distinct: ["skuId"] });
  const stores = await prisma.salesFact.findMany({ where: { weekId: week.id }, select: { storeId: true }, distinct: ["storeId"] });
  const revenueNum = agg._sum.revenue ? Number(agg._sum.revenue) : 0;
  const unitsNum = agg._sum.units ?? 0;
  const fmtCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const summary = { week: week.iso, tenant: DEFAULT_TENANT || "Demo Tenant", kpis: [
    { label: "Total Sales — This Week", value: fmtCurrency(revenueNum) },
    { label: "Units Sold — This Week", value: unitsNum },
    { label: "Active SKUs — This Week", value: skus.length },
    { label: "Active Stores — This Week", value: stores.length },
  ] };
  return NextResponse.json(summary);
});
