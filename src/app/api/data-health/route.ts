import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { withApi } from "../../../../lib/api";
import { DEMO_MODE as ENV_DEMO_MODE, USE_DB as ENV_USE_DB } from "../../../lib/config";
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

  // Resolve effective mode
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? ENV_DEMO_MODE;
  const useDb = ENV_USE_DB && !demoMode;

  if (!useDb) {
    return NextResponse.json(generateDemoHealth(weeks));
  }

  // Fetch latest N weeks
  const weeksList = await prisma.week.findMany({
    orderBy: { startDate: "desc" },
    take: weeks,
    select: { id: true, iso: true, startDate: true },
  });
  if (weeksList.length === 0) return NextResponse.json([]);

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

  return NextResponse.json(results);
});
