import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import { isoFromDate } from "../../../../../lib/db/ingest_helpers";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
  Test-only cleanup endpoint.
  POST /api/test/cleanup
  Headers: x-test-secret: <secret>
  Body JSON: { week: string, storeCodes?: string[], dropEmptyWeek?: boolean }
    - week: ISO week (YYYY-Www), or date (YYYY-MM-DD), or "latest"
    - storeCodes: optional list of store codes to restrict deletion
    - dropEmptyWeek: if true (default), delete the Week row when no facts remain

  Security:
    - Requires header x-test-secret matching TEST_API_SECRET env var when set.
    - In non-production, defaults to 'dev-secret' if TEST_API_SECRET is not set.
*/

function unauthorized(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

async function resolveWeekId(weekParam: string | null): Promise<{ id: number; iso: string } | null> {
  if (!weekParam || weekParam === "latest") {
    const wk = await prisma.week.findFirst({ orderBy: { startDate: "desc" }, select: { id: true, iso: true } });
    return wk;
  }
  if (/^\d{4}-W\d{2}$/.test(weekParam)) {
    const wk = await prisma.week.findFirst({ where: { iso: weekParam }, select: { id: true, iso: true } });
    if (wk) return wk;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    const d = new Date(weekParam);
    if (!isNaN(d.getTime())) {
      const wk = await prisma.week.findFirst({ where: { startDate: { lte: d }, endDate: { gte: d } }, select: { id: true, iso: true } });
      if (wk) return wk;
      const iso = isoFromDate(d);
      const wk2 = await prisma.week.findFirst({ where: { iso }, select: { id: true, iso: true } });
      if (wk2) return wk2;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const hdrSecret = req.headers.get("x-test-secret") || "";
  const envSecret = process.env.TEST_API_SECRET;
  const defaultSecret = "dev-secret";
  const isProd = process.env.NODE_ENV === "production";

  // Require explicit TEST_API_SECRET in production
  if (isProd) {
    if (!envSecret || hdrSecret !== envSecret) {
      return unauthorized("invalid secret");
    }
  } else {
    const expected = envSecret ?? defaultSecret;
    if (!hdrSecret || hdrSecret !== expected) {
      return unauthorized("invalid secret");
    }
  }

  try {
    const body = (await req.json()) as { week?: string; storeCodes?: string[]; dropEmptyWeek?: boolean };
    const weekParam = body.week ?? null;
    const wk = await resolveWeekId(weekParam);
    if (!wk) {
      return NextResponse.json({ ok: true, deleted: 0, week: weekParam ?? "unknown" });
    }

    let storeIds: number[] | undefined;
    if (Array.isArray(body.storeCodes) && body.storeCodes.length > 0) {
      const stores = await prisma.store.findMany({ where: { code: { in: body.storeCodes } }, select: { id: true } });
      const ids = stores.map((s) => s.id);
      storeIds = ids.length > 0 ? ids : undefined; // undefined => no store filter
    }

    const where: Prisma.SalesFactWhereInput = { weekId: wk.id };
    if (storeIds && storeIds.length > 0) {
      (where as Prisma.SalesFactWhereInput).storeId = { in: storeIds };
    }

    const result = await prisma.salesFact.deleteMany({ where });

    // Optionally drop the Week row if it is now empty so that /api/data-health no longer includes it
    const drop = body.dropEmptyWeek !== false; // default true
    let weekDeleted = false;
    if (drop) {
      const remain = await prisma.salesFact.count({ where: { weekId: wk.id } });
      if (remain === 0) {
        await prisma.week.delete({ where: { id: wk.id } });
        weekDeleted = true;
      }
    }

    return NextResponse.json({ ok: true, deleted: result.count, isoWeek: wk.iso, weekDeleted });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
