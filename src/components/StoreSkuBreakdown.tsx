"use client";
import React from "react";

export type SkuItem = {
  skuId: number;
  skuName: string;
  brand?: string;
  revenue: number;
  units: number;
};

export default function StoreSkuBreakdown({ items, demoMode }: { items: SkuItem[] | null | undefined; demoMode?: boolean }) {
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

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

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse" aria-hidden="true" data-testid="sku-skeleton">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-white/5" />
        ))}
      </div>
    );
  }

  if (demoMode && (items?.length ?? 0) === 0) {
    return (
      <div className="space-y-2 animate-pulse" aria-hidden="true" data-testid="sku-skeleton">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-white/5" />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <div className="text-white/60 text-sm" data-testid="sku-empty">No SKU activity for the selected week.</div>;
  }

  return (
    <div className={`overflow-x-auto transition-all duration-300 ease-out ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`} aria-busy={isLoading}>
      <table className="min-w-full text-sm" data-testid="sku-breakdown-table">
        <thead>
          <tr className="text-white/60">
            <th className="text-left font-medium pb-2 pr-3">SKU</th>
            <th className="text-left font-medium pb-2 pr-3 hidden sm:table-cell">Brand</th>
            <th className="text-right font-medium pb-2 pr-3">Revenue</th>
            <th className="text-right font-medium pb-2">Units</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.skuId} className="border-t border-white/5 hover:bg-white/5 transition-colors" data-testid="sku-row">
              <td className="py-2.5 pr-3">
                <div className="text-white/90" data-testid="sku-name">{it.skuName}</div>
                <div className="text-white/40 text-xs sm:hidden">{it.brand || "—"}</div>
              </td>
              <td className="py-2.5 pr-3 hidden sm:table-cell text-white/80">{it.brand || "—"}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums" data-testid="sku-revenue">{fmtCurrency(it.revenue)}</td>
              <td className="py-2.5 text-right tabular-nums" data-testid="sku-units">{fmtNumber(it.units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
