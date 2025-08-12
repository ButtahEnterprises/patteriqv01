"use client";

import React from "react";
import { Globe, TrendingUp, Package } from "lucide-react";

type UltaComSku = {
  skuId: number;
  skuName: string;
  brand?: string;
  upc?: string;
  revenue: number;
  units: number;
  week: string;
};

type UltaComMetricsData = {
  unitsSold: number;
  revenue: number;
  topSkus: UltaComSku[];
  revenuePercentageOfTotal?: number;
  weekOverWeekChange?: {
    units: { current: number; previous: number; percentage: number };
    revenue: { current: number; previous: number; percentage: number };
  };
};

interface UltaComMetricsProps {
  currentWeek?: string;
  demoMode?: boolean;
  totalRevenue?: number;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export default function UltaComMetrics({ 
  currentWeek = "latest", 
  demoMode = false,
  totalRevenue = 0
}: UltaComMetricsProps) {
  const [metrics, setMetrics] = React.useState<UltaComMetricsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchMetrics = async () => {
      if (demoMode) {
        // Demo data for Ulta.com
        const ultaRevenue = 156800;
        const revenuePercentage = totalRevenue > 0 ? (ultaRevenue / totalRevenue) * 100 : 0;
        
        setMetrics({
          unitsSold: 8420,
          revenue: ultaRevenue,
          revenuePercentageOfTotal: revenuePercentage,
          weekOverWeekChange: {
            units: { current: 8420, previous: 7890, percentage: 6.7 },
            revenue: { current: ultaRevenue, previous: 142300, percentage: 10.2 }
          },
          topSkus: [
            { skuId: 1, skuName: "Rare Beauty Soft Pinch Liquid Blush", brand: "Rare Beauty", upc: "123456789", revenue: 24500, units: 350, week: currentWeek },
            { skuId: 2, skuName: "Fenty Beauty Gloss Bomb Universal Lip Luminizer", brand: "Fenty Beauty", upc: "234567890", revenue: 18200, units: 260, week: currentWeek },
            { skuId: 3, skuName: "Charlotte Tilbury Pillow Talk Lipstick", brand: "Charlotte Tilbury", upc: "345678901", revenue: 15600, units: 195, week: currentWeek },
            { skuId: 4, skuName: "Urban Decay All Nighter Setting Spray", brand: "Urban Decay", upc: "456789012", revenue: 12800, units: 160, week: currentWeek },
            { skuId: 5, skuName: "Drunk Elephant C-Firma Day Serum", brand: "Drunk Elephant", upc: "567890123", revenue: 11200, units: 140, week: currentWeek }
          ]
        });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/ulta-com-metrics?week=${encodeURIComponent(currentWeek)}`);
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
        } else {
          setError('Failed to fetch Ulta.com metrics');
        }
      } catch (err) {
        console.error('Error fetching Ulta.com metrics:', err);
        setError('Error loading Ulta.com data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [currentWeek, demoMode]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-6 h-[480px] animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
            <Globe className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ulta.com Performance</h3>
            <p className="text-sm text-gray-600">E-commerce channel metrics</p>
          </div>
        </div>
        <div className="text-gray-500">Loading Ulta.com metrics...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-2xl bg-gradient-to-b from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-[#4a9eff]/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-[#4a9eff]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Ulta.com Performance</h3>
            <p className="text-sm text-white/70">E-commerce channel metrics</p>
          </div>
        </div>
        <div className="text-white/50">{error || 'No Ulta.com data available'}</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-[#4a9eff]/10 flex items-center justify-center">
          <Globe className="h-5 w-5 text-[#4a9eff]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Ulta.com Performance</h3>
          <p className="text-sm text-white/70">E-commerce channel metrics</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-[#4a9eff]" />
            <span className="text-xs uppercase tracking-wider text-white/70">Units Sold</span>
          </div>
          <div className="text-2xl font-semibold text-white">{fmtNumber(metrics.unitsSold)}</div>
          {metrics.weekOverWeekChange && (
            <div className={`flex items-center text-xs mt-2 ${metrics.weekOverWeekChange.units.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <TrendingUp className={`h-3 w-3 mr-1 ${metrics.weekOverWeekChange.units.percentage >= 0 ? '' : 'rotate-180'}`} />
              {metrics.weekOverWeekChange.units.percentage >= 0 ? '+' : ''}{metrics.weekOverWeekChange.units.percentage.toFixed(1)}% vs last week
            </div>
          )}
        </div>
        
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[#4a9eff]" />
            <span className="text-xs uppercase tracking-wider text-white/70">Revenue</span>
          </div>
          <div className="text-2xl font-semibold text-white">{fmtCurrency(metrics.revenue)}</div>
          <div className="flex items-center justify-between mt-2">
            {metrics.weekOverWeekChange && (
              <div className={`flex items-center text-xs ${metrics.weekOverWeekChange.revenue.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                <TrendingUp className={`h-3 w-3 mr-1 ${metrics.weekOverWeekChange.revenue.percentage >= 0 ? '' : 'rotate-180'}`} />
                {metrics.weekOverWeekChange.revenue.percentage >= 0 ? '+' : ''}{metrics.weekOverWeekChange.revenue.percentage.toFixed(1)}% vs last week
              </div>
            )}
            {metrics.revenuePercentageOfTotal && metrics.revenuePercentageOfTotal > 0 && (
              <div className="text-xs text-[#4a9eff]">
                {metrics.revenuePercentageOfTotal.toFixed(1)}% of total
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top SKUs */}
      <div>
        <h4 className="text-sm font-medium text-white mb-3">Top Selling SKUs</h4>
        <div className="space-y-2">
          {metrics.topSkus.slice(0, 5).map((sku, index) => (
            <div key={sku.skuId} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#4a9eff] font-medium">#{index + 1}</span>
                  <span className="text-sm font-medium text-white">{sku.skuName}</span>
                </div>
                {sku.brand && (
                  <div className="text-xs text-white/70 mt-1">{sku.brand}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">{fmtNumber(sku.units)} units</div>
                <div className="text-xs text-white/50">{fmtCurrency(sku.revenue)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
