import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { demoWeeklySummary } from "../../../lib/demo";
import { withApi } from "../../../../lib/api";
import { DEFAULT_TENANT, DEMO_MODE as ENV_DEMO_MODE, USE_DB as ENV_USE_DB } from "../../../lib/config";

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
  const demoMode = cookieDemo ?? ENV_DEMO_MODE;
  const useDb = ENV_USE_DB && !demoMode;

  if (!useDb) {
    return NextResponse.json(demoWeeklySummary);
  }

  // Find the most recent Week
  const week = await prisma.week.findFirst({ orderBy: { startDate: "desc" } });
  if (!week) {
    // No data yet, serve demo summary
    return NextResponse.json(demoWeeklySummary);
  }

  // Aggregate sales for that week
  const agg = await prisma.salesFact.aggregate({
    where: { weekId: week.id },
    _sum: { revenue: true, units: true },
  });

  // Distinct SKU and Store counts
  const skus = await prisma.salesFact.findMany({
    where: { weekId: week.id },
    select: { skuId: true },
    distinct: ["skuId"],
  });
  const stores = await prisma.salesFact.findMany({
    where: { weekId: week.id },
    select: { storeId: true },
    distinct: ["storeId"],
  });

  const revenueNum = agg._sum.revenue ? Number(agg._sum.revenue) : 0;
  const unitsNum = agg._sum.units ?? 0;

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const summary = {
    week: week.iso,
    tenant: DEFAULT_TENANT || "Demo Tenant",
    kpis: [
      { label: "Total Sales — This Week", value: fmtCurrency(revenueNum) },
      { label: "Units Sold — This Week", value: unitsNum },
      { label: "Active SKUs — This Week", value: skus.length },
      { label: "Active Stores — This Week", value: stores.length },
    ],
  };

  return NextResponse.json(summary);
});
