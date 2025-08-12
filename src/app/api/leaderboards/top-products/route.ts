import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { withApi } from "../../../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../../lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEMO_COOKIE = "piq_demo_mode";

type ByMetric = "units" | "revenue";

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

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

function randomFromSeed(seed: number) {
  let x = Math.sin(seed) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

function generateDemoProducts(by: ByMetric, limit: number) {
  const rand = randomFromSeed(4242 + (by === "units" ? 1 : 2));
  const brands = ["Acme", "Nova", "Zen", "Apex", "Halo", "Flux", "Lumo", "Vivid", "Orion", "Pulse"]; 
  const items = Array.from({ length: 12 }).map((_, i) => {
    const baseRev = Math.round(5000 + rand() * 25000);
    const units = Math.round(100 + rand() * 900);
    const revenue = Math.round(baseRev + units * (1 + rand()));
    const brand = brands[i % brands.length];
    return { skuId: 20000 + i, skuName: `${brand} SKU ${i + 1}` , brand, revenue, units };
  });
  items.sort((a, b) => (by === "units" ? b.units - a.units : b.revenue - a.revenue));
  return items.slice(0, limit);
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const byParam = (url.searchParams.get("by") || "units").toLowerCase();
  const by: ByMetric = byParam === "revenue" ? "revenue" : "units";
  const limitParam = Number.parseInt(url.searchParams.get("limit") || "5", 10);
  const limit = clamp(Number.isFinite(limitParam) ? limitParam : 5, 1, 20);

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  if (!useDb) {
    return NextResponse.json(generateDemoProducts(by, limit));
  }

  // Determine latest week with any sales data
  const latestWeek = await prisma.week.findFirst({ orderBy: { startDate: "desc" }, select: { id: true, iso: true } });
  if (!latestWeek) return NextResponse.json([]);

  const grouped = await prisma.salesFact.groupBy({
    by: ["skuId"],
    where: { weekId: latestWeek.id },
    _sum: { revenue: true, units: true },
  });
  if (grouped.length === 0) return NextResponse.json([]);

  const skuIds = grouped.map((g) => g.skuId);
  const skus = skuIds.length
    ? await prisma.sku.findMany({ where: { id: { in: skuIds } }, select: { id: true, name: true, brand: true } })
    : [];
  const meta = new Map(skus.map((s) => [s.id, { name: s.name, brand: s.brand || undefined }]));

  const items = grouped
    .map((g) => ({
      skuId: g.skuId,
      skuName: meta.get(g.skuId)?.name || String(g.skuId),
      brand: meta.get(g.skuId)?.brand,
      revenue: g._sum.revenue ? Number(g._sum.revenue) : 0,
      units: g._sum.units ?? 0,
    }))
    .sort((a, b) => (by === "units" ? b.units - a.units : b.revenue - a.revenue))
    .slice(0, limit);

  return NextResponse.json(items);
});
