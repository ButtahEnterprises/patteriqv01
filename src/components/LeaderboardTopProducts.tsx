"use client";
import React from "react";
import { Card, CardContent, CardHeader } from "./ui/card";

export type ProductItem = {
  skuId: number;
  skuName: string;
  brand?: string | null;
  revenue: number;
  units: number;
};

type ByMetric = "units" | "revenue";

export default function LeaderboardTopProducts({
  items,
  by,
  demoMode,
}: {
  items: ProductItem[] | null | undefined;
  by: ByMetric;
  demoMode?: boolean;
}) {
  const isLoading = items == null;
  const [revealed, setRevealed] = React.useState(false);
  React.useEffect(() => {
    if (isLoading) {
      setRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [isLoading, items]);

  const title = by === "units" ? "Top Products — Units" : "Top Products — Revenue";
  const testId = by === "units" ? "top-products-units" : "top-products-revenue";
  const ariaLabel = by === "units" ? "Top Products by Units" : "Top Products by Revenue";

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

  const emptyText = demoMode ? "No leaderboard data in current mode" : "No data yet. Waiting for ingestion...";

  return (
    <Card
      className="group h-[360px] transition-colors duration-200 hover:border-white/10"
      role="region"
      aria-label={ariaLabel}
      aria-busy={isLoading}
      data-testid={testId}
    >
      <CardHeader className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-white/80">{title}</div>
        {demoMode ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[11px]">
            Demo Data
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/70 border border-white/15 px-2.5 py-0.5 text-[11px]">
            Live
          </span>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <ul className="space-y-3 mt-2" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded bg-white/10" />
                  <div className="h-3 w-40 sm:w-48 rounded bg-white/10" />
                </div>
                <div className="h-3 w-20 sm:w-24 rounded bg-white/10" />
              </li>
            ))}
          </ul>
        ) : !items || items.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-white/60 text-sm">{emptyText}</div>
        ) : (
          <ul className={`space-y-3 mt-2 transition-all duration-300 ease-out ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
            {items.map((it, idx) => (
              <li key={it.skuId} className="flex items-center justify-between" data-testid="product-row">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-6 w-6 rounded-lg bg-white/10 text-white/70 text-xs flex items-center justify-center font-medium">
                    {idx + 1}
                  </div>
                  <div className="truncate">
                    <div className="text-white/90 truncate" title={it.skuName} data-testid="product-name">{it.skuName}</div>
                    {it.brand ? (
                      <div className="text-[11px] text-white/60 truncate" data-testid="product-brand">{it.brand}</div>
                    ) : null}
                  </div>
                </div>
                <div className="text-white/85 font-mono text-sm" data-testid="product-metric">
                  {by === "units" ? fmtNumber(it.units) : fmtCurrency(it.revenue)}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="sr-only">Ordered list of {by === "units" ? "most sold products by units" : "top revenue products"}.</p>
      </CardContent>
    </Card>
  );
}
