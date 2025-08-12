import { NextResponse } from "next/server";
import prisma from "../../../../../../lib/prisma";
import { withApi } from "../../../../../../lib/api";
import { getDemoModeEnv, getUseDbEnv } from "../../../../../lib/config";

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

function getStoreIdFromPath(pathname: string): number | null {
  // Expect: /api/stores/:storeId/sku-breakdown
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("stores");
  if (idx >= 0 && parts.length > idx + 1) {
    const sid = Number.parseInt(parts[idx + 1], 10);
    return Number.isFinite(sid) ? sid : null;
  }
  return null;
}

function randomFromSeed(seed: number) {
  let x = Math.sin(seed) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

function generateDemoBreakdown(storeId: number) {
  const rand = randomFromSeed(storeId + 12345);
  const brands = ["Acme", "Nova", "Zen", "Apex", "Halo", "Flux", "Lumo", "Vivid"]; 
  const items = Array.from({ length: 8 }).map((_, i) => {
    const revenue = Math.round(8000 + rand() * 12000);
    const units = Math.round(150 + rand() * 400);
    const brand = brands[i % brands.length];
    return { skuId: 10000 + i, skuName: `${brand} SKU ${i + 1}`, brand, revenue, units };
  });
  items.sort((a, b) => b.revenue - a.revenue);
  return {
    store: { id: storeId, name: `Demo Store #${storeId}`, city: "", state: "" },
    week: { iso: "2025-W32" },
    items,
  };
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const storeId = getStoreIdFromPath(pathname);
  if (!storeId) return NextResponse.json({ ok: false, error: "Invalid storeId" }, { status: 400 });

  const weekParam = (url.searchParams.get("week") || "latest").toLowerCase();

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  if (!useDb) {
    return NextResponse.json(generateDemoBreakdown(storeId));
  }

  // Determine target week
  let week = null as null | { id: number; iso: string };
  if (weekParam === "latest") {
    week = await prisma.week.findFirst({
      where: { sales: { some: { storeId } } },
      orderBy: { startDate: "desc" },
      select: { id: true, iso: true },
    });
  } else {
    // Accept ISO like 2025-W32
    week = await prisma.week.findFirst({ where: { iso: weekParam.toUpperCase() }, select: { id: true, iso: true } });
  }
  if (!week) return NextResponse.json({ store: null, week: null, items: [] });

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, name: true, city: true, state: true } });

  const grouped = await prisma.salesFact.groupBy({
    by: ["skuId"],
    where: { storeId, weekId: week.id },
    _sum: { revenue: true, units: true },
  });
  const skuIds = grouped.map((g) => g.skuId);
  const skus = skuIds.length
    ? await prisma.sku.findMany({ where: { id: { in: skuIds } }, select: { id: true, name: true, brand: true } })
    : [];
  const nameById = new Map(skus.map((s) => [s.id, { name: s.name, brand: s.brand || undefined }]));

  const items = grouped
    .map((g) => ({
      skuId: g.skuId,
      skuName: nameById.get(g.skuId)?.name || String(g.skuId),
      brand: nameById.get(g.skuId)?.brand,
      revenue: g._sum.revenue ? Number(g._sum.revenue) : 0,
      units: g._sum.units ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  return NextResponse.json({ store, week, items });
});
