// Server component: fetch API routes directly
import { BadgeDollarSign, Package, Boxes, Store } from "lucide-react";
import { headers } from "next/headers";
import KpiTrendChart from "../components/KpiTrendChart";
import DataHealthCard from "../components/DataHealthCard";
import StoresAtRiskList from "../components/StoresAtRiskList";
import LeaderboardTopProducts from "../components/LeaderboardTopProducts";
import LeaderboardTopStores from "../components/LeaderboardTopStores";
import PromotionCalendar from "../components/PromotionCalendar";
import { demoTrendData } from "../lib/demo_trend_data";

export const dynamic = "force-dynamic";

// Presentation formatters (frontend-only, do not change backend)
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

const toNumber = (v: string | number): number => {
  if (typeof v === "number") return v;
  // strip $ and commas
  const cleaned = v.replace(/[^0-9.-]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

type WeeklySummary = {
  week: string;
  tenant: string;
  kpis: Array<{ label: string; value: string | number; note?: string }>;
};

type PromotionApiItem = {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  type?: string;
  tags?: string[];
  metrics: { baselineAvg: number; promoAvg: number; effectPct: number };
  weeks: Array<{ isoWeek: string; revenue: number }>;
};

function StatCard({
  icon, title, value, note,
}: { icon: React.ReactNode; title: string; value: string | number; note?: string; }) {
  const isCurrency = /sales|revenue|gmv/i.test(title);
  const num = toNumber(value);
  const display = isCurrency ? fmtCurrency(num) : fmtNumber(num);
  return (
    <div className="group rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 shadow transition-colors duration-200 hover:border-white/10">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center transition-colors duration-200 group-hover:bg-white/10">
          {icon}
        </div>
        <div className="text-[11px] sm:text-xs uppercase tracking-wider text-white/70">{title}</div>
      </div>
      <div className="text-3xl sm:text-4xl font-semibold leading-tight">{display}</div>
      {note ? <div className="mt-1 text-xs sm:text-sm text-white/50">{note}</div> : null}
    </div>
  );
}

export default async function Page() {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  async function getJson<T>(input: string, fallback: T, originOverride?: string): Promise<T> {
    try {
      const url = /^https?:\/\//.test(input)
        ? input
        : `${originOverride ?? origin}${input.startsWith("/") ? input : `/${input}`}`;
      const res = await fetch(url, { cache: "no-store", headers: { cookie } });
      if (!res.ok) return fallback;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) return fallback;
      return (await res.json()) as T;
    } catch {
      return fallback;
    }
  }

  const promotionsUrl = `/api/promotions?years=2024,2025`;
  const promotionsReq = fetch(`${origin}${promotionsUrl}`, { cache: "no-store", headers: { cookie } });

  const [
    cfg,
    weekly,
    trendApi,
    riskApi,
    dataHealthApi,
    topUnitsApi,
    topRevenueApi,
    topStoresApi,
  ] = await Promise.all([
    getJson<{ demoMode: boolean }>(`/api/config`, { demoMode: true }, origin),
    getJson<WeeklySummary>(
      `/api/weekly-summary`,
      {
        week: "N/A",
        tenant: "Demo Tenant",
        kpis: [
          { label: "Total Sales — This Week", value: "$0" },
          { label: "Units Sold — This Week", value: 0 },
          { label: "Active SKUs — This Week", value: 0 },
          { label: "Active Stores — This Week", value: 0 },
        ],
      },
      origin
    ),
    getJson<Array<{ isoWeek: string; revenue: number; units: number }>>(`/api/kpi/trend?weeks=12`, [], origin),
    getJson<Array<{ storeId: number; storeName: string; zScore: number; pctChange: number; topSkuCount: number }>>(
      `/api/stores-at-risk?lookback=8&limit=10`,
      [],
      origin
    ),
    getJson<Array<{ isoWeek: string; totalStores: number; pseudoStores: number; pctFullAllocated: number }>>(
      `/api/data-health?weeks=12`,
      [],
      origin
    ),
    getJson<Array<{ skuId: number; skuName: string; brand?: string; revenue: number; units: number }>>(
      `/api/leaderboards/top-products?by=units&limit=5`,
      [],
      origin
    ),
    getJson<Array<{ skuId: number; skuName: string; brand?: string; revenue: number; units: number }>>(
      `/api/leaderboards/top-products?by=revenue&limit=5`,
      [],
      origin
    ),
    getJson<Array<{ storeId: number; storeName: string; city?: string; state?: string; revenue: number; units: number }>>(
      `/api/leaderboards/top-stores?limit=5`,
      [],
      origin
    ),
  ]);
  let promotions: PromotionApiItem[] = [];
  let promotionsError: string | null = null;
  try {
    const res = await promotionsReq;
    if (!res || !res.ok) {
      promotionsError = res ? `HTTP ${res.status} ${res.statusText}` : "Network error";
    } else {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        promotionsError = `Unexpected content-type: ${ct || "unknown"}`;
      } else {
        promotions = (await res.json()) as PromotionApiItem[];
      }
    }
  } catch {
    promotionsError = "Failed to fetch promotions.";
  }

  const trend = cfg.demoMode ? demoTrendData : trendApi;
  const risk = cfg.demoMode ? [] : riskApi;
  const dataHealth = dataHealthApi; // API already respects Demo/Live via cookie
  const topUnits = topUnitsApi;
  const topRevenue = topRevenueApi;
  const topStores = topStoresApi;
  return (
    <main>

      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-5 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
            <div>
              <div className="text-xl sm:text-2xl font-semibold">PatternIQ Analytics</div>
              <div className="text-white/70 text-xs sm:text-sm">Enterprise Retail Intelligence Dashboard</div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="rounded-xl bg-white/5 border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm">
                Week: <span className="text-white ml-1">{weekly.week}</span>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm">
                Updated: <span className="text-white ml-1">Just now</span>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm">
                Tenant: <span className="text-white ml-1">{weekly.tenant}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<BadgeDollarSign className="h-5 w-5 text-yellow-300" />}
            title={weekly.kpis[0].label} value={weekly.kpis[0].value} note={weekly.kpis[0].note} />
          <StatCard icon={<Package className="h-5 w-5 text-blue-300" />}
            title={weekly.kpis[1].label} value={weekly.kpis[1].value} note={weekly.kpis[1].note} />
          <StatCard icon={<Boxes className="h-5 w-5 text-purple-300" />}
            title={weekly.kpis[2].label} value={weekly.kpis[2].value} note={weekly.kpis[2].note} />
          <StatCard icon={<Store className="h-5 w-5 text-teal-300" />}
            title={weekly.kpis[3].label} value={weekly.kpis[3].value} note={weekly.kpis[3].note} />
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-6 sm:mt-8">
          <KpiTrendChart data={trend} demoMode={cfg.demoMode} />
          <DataHealthCard data={dataHealth} demoMode={cfg.demoMode} />
        </div>

        {/* Promotion Calendar */}
        <div className="mt-6 sm:mt-8">
          <PromotionCalendar items={promotions} demoMode={cfg.demoMode} error={promotionsError} />
        </div>

        {/* Leaderboards */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 mt-6 sm:mt-8">
          <LeaderboardTopProducts items={topUnits} by="units" demoMode={cfg.demoMode} />
          <LeaderboardTopProducts items={topRevenue} by="revenue" demoMode={cfg.demoMode} />
          <LeaderboardTopStores items={topStores} demoMode={cfg.demoMode} />
        </div>

        {/* Declining growth (existing) */}
        <div className="mt-6 sm:mt-8">
          <StoresAtRiskList items={risk} demoMode={cfg.demoMode} />
        </div>
      </div>
    </main>
  );
}
