"use client";

import React from "react";
import { Trophy, TrendingDown } from "lucide-react";

export type StorePerformanceData = {
  bestStore: {
    name: string;
    city?: string;
    state?: string;
    revenue: number;
    note?: string;
  } | null;
  worstStore: {
    name: string;
    city?: string;
    state?: string;
    revenue: number;
    wowChange?: number;
    note?: string;
  } | null;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export default function StorePerformanceHighlights({
  currentWeek,
}: {
  currentWeek?: string;
}) {
  const [data, setData] = React.useState<StorePerformanceData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchStorePerformance() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/store-performance?week=${currentWeek || 'latest'}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          setError('Failed to fetch store performance data');
        }
      } catch (err) {
        console.error('Error fetching store performance:', err);
        setError('Error loading store performance data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStorePerformance();
  }, [currentWeek]);

  if (isLoading) {
    return (
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6 animate-pulse">
          <div className="h-24 bg-white/5 rounded"></div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6 animate-pulse">
          <div className="h-24 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6">
          <div className="text-white/50 text-center">Error loading store performance data</div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6">
          <div className="text-white/50 text-center">Error loading store performance data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      {/* Best Performing Store */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <Trophy className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Top Performing Store</h3>
            <p className="text-sm text-white/70">Highest sales this week</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-1 text-xs">
              Top Store
            </span>
          </div>
        </div>
        
        {data?.bestStore ? (
          <div>
            <div className="text-2xl font-bold text-white mb-1">
              {data.bestStore.name}
            </div>
            {data.bestStore.city && data.bestStore.state && (
              <div className="text-sm text-white/60 mb-3">
                {data.bestStore.city}, {data.bestStore.state}
              </div>
            )}
            <div className="text-3xl font-bold text-yellow-400 mb-1">
              {fmtCurrency(data.bestStore.revenue)}
            </div>
            <div className="text-sm text-white/70">
              {data.bestStore.note || `Highest sales this week${currentWeek ? ` (${currentWeek})` : ''}`}
            </div>
          </div>
        ) : (
          <div className="text-white/50">No store data available</div>
        )}
      </div>

      {/* Worst Performing Store */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/20">
            <TrendingDown className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Least Performing Store</h3>
            <p className="text-sm text-white/70">Lowest sales this week</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 px-2 py-1 text-xs">
              Least Store
            </span>
          </div>
        </div>
        
        {data?.worstStore ? (
          <div>
            <div className="text-2xl font-bold text-white mb-1">
              {data.worstStore.name}
            </div>
            {data.worstStore.city && data.worstStore.state && (
              <div className="text-sm text-white/60 mb-3">
                {data.worstStore.city}, {data.worstStore.state}
              </div>
            )}
            <div className="text-3xl font-bold text-red-400 mb-1">
              {fmtCurrency(data.worstStore.revenue)}
            </div>
            <div className="text-sm text-white/70">
              {data.worstStore.note || `Lowest sales this week${currentWeek ? ` (${currentWeek})` : ''}`}
            </div>
          </div>
        ) : (
          <div className="text-white/50">No store data available</div>
        )}
      </div>
    </div>
  );
}
