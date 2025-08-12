import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { withApi } from '../../../../lib/api';
import { getDemoModeEnv, getUseDbEnv } from '../../../lib/config';

export const dynamic = 'force-dynamic';

const DEMO_COOKIE = 'piq_demo_mode';

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  return undefined;
}

export const GET = withApi(async (req: Request) => {
  const cookies = parseCookies(req.headers.get('cookie'));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();
  const useDb = getUseDbEnv() && !demoMode;

  const flags = {
    USE_DB: process.env.USE_DB,
    EVENTS_ON: process.env.EVENTS_ON,
    RISK_ON: process.env.RISK_ON,
    AGENT_ON: process.env.AGENT_ON,
  } as const;

  const db = { up: false, latencyMs: null as number | null, error: null as string | null, skipped: !useDb };
  if (useDb) {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      db.up = true;
      db.latencyMs = Date.now() - start;
    } catch (e: unknown) {
      db.error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    ok: true,
    service: 'patterniq-v01',
    time: new Date().toISOString(),
    mode: { demoMode, useDb },
    flags,
    db,
  });
});
