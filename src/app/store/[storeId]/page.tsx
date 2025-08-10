import { ArrowLeft, Store as StoreIcon } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import KpiTrendChart from "../../../components/KpiTrendChart";
import StoreSkuBreakdown from "../../../components/StoreSkuBreakdown";

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

export default async function StorePage({ params }: { params: Promise<{ storeId: string }> }) {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;
  const { storeId } = await params;
  const storeIdNum = Number.parseInt(storeId, 10);
  const cfg = await getJson<{ demoMode: boolean }>(`/api/config`, cookie, { demoMode: true }, origin);
  const trend = await getJson<Array<{ isoWeek: string; revenue: number; units: number }>>(
    `/api/stores/${storeIdNum}/trend?weeks=8`,
    cookie,
    [],
    origin
  );
  const breakdown = await getJson<{
    store: { id: number; name: string; city?: string | null; state?: string | null } | null;
    week: { iso: string } | null;
    items: Array<{ skuId: number; skuName: string; brand?: string; revenue: number; units: number }>;
  }>(`/api/stores/${storeIdNum}/sku-breakdown?week=latest`, cookie, { store: null, week: null, items: [] }, origin);

  const title = breakdown.store?.name || `Store #${storeIdNum}`;
  const location = [breakdown.store?.city, breakdown.store?.state].filter(Boolean).join(", ");

  return (
    <main>
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
              <StoreIcon className="h-5 w-5 text-teal-300" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-semibold" data-testid="store-title">{title}</div>
              <div className="text-white/60 text-xs sm:text-sm" data-testid="store-subtitle">{location || "Location Unknown"}{breakdown.week?.iso ? ` • Week ${breakdown.week.iso}` : ""}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 sm:p-6">
            <div className="text-sm text-white/70 mb-3">8-Week Revenue & Units</div>
            <KpiTrendChart data={trend} demoMode={cfg.demoMode} />
          </div>
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 sm:p-6">
            <div className="text-sm text-white/70 mb-3">Latest Week SKU Breakdown</div>
            <StoreSkuBreakdown items={breakdown.items} demoMode={cfg.demoMode} />
          </div>
        </div>
      </div>
    </main>
  );
}
