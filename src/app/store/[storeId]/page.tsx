import { headers } from "next/headers";
import ClientStorePageLoader from "../../../components/ClientStorePageLoader";

export const dynamic = "force-dynamic";

async function getJson<T>(input: string, cookie: string, fallback: T, origin?: string): Promise<T> {
  try {
    const url = /^https?:\/\//.test(input)
      ? input
      : `${origin ?? "http://localhost:3000"}${input.startsWith("/") ? input : `/${input}`}`;
    const res = await fetch(url, { cache: "no-store", headers: { cookie } });
    if (!res.ok) return fallback;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return fallback;
    return (await res.json()) as T;
  } catch { return fallback; }
}

type SearchParamsType = { [key: string]: string | string[] | undefined };

export default async function StorePage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams?: Promise<SearchParamsType> | undefined }) {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const { storeId } = await params;
  const storeIdNum = Number.parseInt(storeId, 10);
  const sp: SearchParamsType | undefined = searchParams ? await searchParams : undefined;
  const weekFromUrl = (Array.isArray(sp?.week) ? sp?.week[0] : sp?.week) as string | undefined;
  const weeksWindowFromUrl = (Array.isArray(sp?.weeks) ? sp?.weeks[0] : sp?.weeks) as string | undefined;
  const selectedWeek = weekFromUrl && weekFromUrl.trim() !== "" ? weekFromUrl : "latest";
  const weeksWindow = (() => {
    const n = Number.parseInt(weeksWindowFromUrl ?? "", 10);
    if (!Number.isFinite(n)) return 8;
    return Math.min(Math.max(n, 1), 104);
  })();
  const cfg = await getJson<{ demoMode: boolean }>(`/api/config`, cookie, { demoMode: true }, origin);
  const trend = await getJson<Array<{ isoWeek: string; revenue: number; units: number }>>(
    `/api/stores/${storeIdNum}/trend?weeks=${weeksWindow}&week=${encodeURIComponent(selectedWeek)}`,
    cookie,
    [],
    origin
  );
  const breakdown = await getJson<{
    store: { id: number; name: string; city?: string | null; state?: string | null } | null;
    week: { iso: string } | null;
    items: Array<{ skuId: number; skuName: string; brand?: string; revenue: number; units: number }>;
  }>(`/api/stores/${storeIdNum}/sku-breakdown?week=${encodeURIComponent(selectedWeek)}`,
    cookie,
    { store: null, week: null, items: [] },
    origin
  );

  const title = breakdown.store?.name || `Store #${storeIdNum}`;
  const location = [breakdown.store?.city, breakdown.store?.state].filter(Boolean).join(", ");

  return (
    <ClientStorePageLoader
      title={title}
      location={location}
      selectedWeek={selectedWeek}
      weeksWindow={weeksWindow}
      trend={trend}
      breakdownItems={breakdown.items}
      cfgDemo={cfg.demoMode}
      weekIso={breakdown.week?.iso ?? null}
    />
  );
}
