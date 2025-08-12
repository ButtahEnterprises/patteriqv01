import { NextResponse } from "next/server";
import { withApi } from "../../../../lib/api";
import { DEFAULT_TENANT, getDemoModeEnv, getUseDbEnv, RISK_THRESHOLD } from "../../../lib/config";

export const dynamic = "force-dynamic";

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

export const GET = withApi(async (_req: Request) => {
  const cookies = parseCookies(_req.headers.get("cookie"));
  const cookieDemo = parseBool(cookies[DEMO_COOKIE]);
  const demoMode = cookieDemo ?? getDemoModeEnv();

  return NextResponse.json({
    demoMode,
    defaultTenant: DEFAULT_TENANT,
    useDb: getUseDbEnv() && !demoMode,
    riskThreshold: RISK_THRESHOLD,
  });
});

export const POST = withApi(async (req: Request) => {
  type Body = { demoMode?: unknown; mode?: unknown };
  const body: Body = await (async () => {
    try {
      return (await req.json()) as Body;
    } catch {
      return {} as Body;
    }
  })();

  // Accept { demoMode: boolean } or { mode: 'demo' | 'live' }
  let desired: boolean | undefined = parseBool(body?.demoMode);
  if (desired === undefined && typeof body?.mode === "string") {
    const m = String(body.mode).toLowerCase();
    if (m === "demo") desired = true;
    if (m === "live") desired = false;
  }

  if (desired === undefined) {
    return NextResponse.json({ ok: false, error: "Invalid payload: expected { demoMode: boolean }" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, demoMode: desired });
  // Session cookie (no maxAge) so it clears when browser session ends
  res.cookies.set(DEMO_COOKIE, String(desired), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
});
