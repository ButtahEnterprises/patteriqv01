import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { withApi } from "../../../../../lib/api";
import { DEMO_MODE as ENV_DEMO_MODE, USE_DB as ENV_USE_DB } from "../../../../lib/config";

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

function generateDemoStores(limit: number) {
  const rand = randomFromSeed(8989);
  const cities = ["Austin", "Seattle", "Denver", "Chicago", "Miami", "Boston", "Phoenix", "Dallas", "Portland", "Nashville"];
  const states = ["TX", "WA", "CO", "IL", "FL", "MA", "AZ", "TX", "OR", "TN"];
  const items = Array.from({ length: 12 }).map((_, i) => {
    const revenue = Math.round(30000 + rand() * 90000);
    const units = Math.round(500 + rand() * 3500);
    const name = `Store #${100 + i}`;
    const city = cities[i % cities.length];
    const state = states[i % states.length];
    return { storeId: 100 + i, storeName: name, city, state, revenue, units };
  });
  items.sort((a, b) => b.revenue - a.revenue);
  return items.slice(0, limit);
}

export const GET = withApi(async (req: Request) => {
  const url = new URL(req.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") || "5", 10);
  const limit = clamp(Number.isFinite(limitParam) ? limitParam : 5, 1, 20);

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? ENV_DEMO_MODE;
  const useDb = ENV_USE_DB && !demoMode;

  if (!useDb) {
    return NextResponse.json(generateDemoStores(limit));
  }

  // Determine latest week with any sales data
  const latestWeek = await prisma.week.findFirst({ orderBy: { startDate: "desc" }, select: { id: true } });
  if (!latestWeek) return NextResponse.json([]);

  const grouped = await prisma.salesFact.groupBy({
    by: ["storeId"],
    where: { weekId: latestWeek.id },
    _sum: { revenue: true, units: true },
  });
  if (grouped.length === 0) return NextResponse.json([]);

  const storeIds = grouped.map((g) => g.storeId);
  const stores = storeIds.length
    ? await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true, city: true, state: true } })
    : [];
  const meta = new Map(stores.map((s) => [s.id, { name: s.name, city: s.city, state: s.state }]));

  const items = grouped
    .map((g) => ({
      storeId: g.storeId,
      storeName: meta.get(g.storeId)?.name || String(g.storeId),
      city: meta.get(g.storeId)?.city,
      state: meta.get(g.storeId)?.state,
      revenue: g._sum.revenue ? Number(g._sum.revenue) : 0,
      units: g._sum.units ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return NextResponse.json(items);
});
