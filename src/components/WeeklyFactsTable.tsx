"use client";
import React from "react";
import { Card, CardContent, CardHeader } from "./ui/card";

export type WeeklyFactItem = {
  storeCode: string;
  storeName?: string;
  skuId: number;
  upc?: string;
  skuName?: string;
  units: number;
  revenue: number;
};

export default function WeeklyFactsTable({
  items,
  demoMode,
  limit = 50,
  highlightUpcs,
  highlightAll = false,
}: {
  items: WeeklyFactItem[] | null | undefined;
  demoMode?: boolean;
  limit?: number;
  highlightUpcs?: string[];
  highlightAll?: boolean;
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

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

  const sorted = Array.isArray(items)
    ? [...items].sort((a, b) => b.revenue - a.revenue)
    : [];
  const shown = sorted.slice(0, limit);

  const emptyText = demoMode
    ? "Facts not available in Demo mode"
    : "No facts yet. Ingest Store-Sales to see results.";

  const highlightSet = React.useMemo(() => new Set((highlightUpcs || []).filter(Boolean)), [highlightUpcs]);
  const isHighlighted = (it: WeeklyFactItem): boolean => {
    if (highlightAll) return true;
    const upc = it.upc || "";
    return upc ? highlightSet.has(upc) : false;
  };

  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6 h-[480px] transition-all duration-200 hover:border-[#4a9eff]/30 hover:shadow-lg hover:shadow-[#4a9eff]/10"
      role="region"
      aria-label="Weekly Sales Facts"
      aria-busy={isLoading}
      data-testid="weekly-facts"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-gradient-to-b from-[#4a9eff] to-[#2563eb] rounded-full"></div>
          <div>
            <h3 className="text-xl font-bold text-white">Weekly Sales Facts</h3>
            <p className="text-[#4a9eff]/80 text-sm">Detailed transaction data</p>
          </div>
        </div>
        {demoMode ? (
          <span
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium"
            data-testid="facts-badge"
            data-mode="demo"
          >
            Demo Data
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-2 rounded-full bg-[#4a9eff]/15 text-[#4a9eff] border border-[#4a9eff]/30 px-3 py-1.5 text-xs font-medium"
            data-testid="facts-badge"
            data-mode="live"
          >
            Live Data
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {/* Header row */}
        <div className="grid grid-cols-12 text-sm font-semibold text-[#4a9eff] px-4 py-3 bg-[#4a9eff]/5 rounded-lg border border-[#4a9eff]/10 mb-4">
          <div className="col-span-3 truncate">Store</div>
          <div className="col-span-5 truncate">Product</div>
          <div className="col-span-2 text-right">Units</div>
          <div className="col-span-2 text-right">Revenue</div>
        </div>

        {isLoading ? (
          <ul className="space-y-3 mt-3" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-3 h-3 rounded bg-white/10" />
                <div className="col-span-5 h-3 rounded bg-white/10" />
                <div className="col-span-2 h-3 rounded bg-white/10" />
                <div className="col-span-2 h-3 rounded bg-white/10" />
              </li>
            ))}
          </ul>
        ) : !shown || shown.length === 0 ? (
          <div
            className="h-[340px] flex items-center justify-center text-white/60 text-sm"
            data-testid="facts-empty"
          >
            {emptyText}
          </div>
        ) : (
          <ul
            className={`space-y-1 overflow-auto max-h-[340px] pr-2 transition-all duration-300 ease-out ${
              revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            }`}
          >
            {shown.map((it, idx) => (
              <li
                key={`${it.storeCode}-${it.skuId}-${idx}`}
                className={`grid grid-cols-12 items-center gap-1 rounded-lg px-3 py-2 hover:bg-[#4a9eff]/10 transition-colors border border-transparent hover:border-[#4a9eff]/20 ${isHighlighted(it) ? "bg-amber-500/10 ring-1 ring-amber-500/30 hover:bg-amber-500/15" : "bg-white/5"}`}
                data-testid="facts-row"
                data-promo-highlight={isHighlighted(it) ? "true" : "false"}
              >
                <div className="col-span-3 min-w-0 overflow-hidden">
                  <div className="text-white text-sm font-medium truncate" title={it.storeCode} data-testid="store-code">
                    {it.storeCode}
                  </div>
                  {it.storeName ? (
                    <div className="text-xs text-white/60 truncate" title={it.storeName}>
                      {it.storeName}
                    </div>
                  ) : null}
                </div>
                <div className="col-span-5 min-w-0 overflow-hidden">
                  <div className="text-white text-sm font-medium truncate" title={it.skuName || String(it.skuId)} data-testid="sku">
                    {it.skuName || `SKU ${it.skuId}`}
                  </div>
                  {it.upc ? (
                    <div className="text-xs text-[#4a9eff]/80 truncate" title={it.upc} data-testid="upc">
                      UPC {it.upc}
                    </div>
                  ) : null}
                </div>
                <div className="col-span-2 text-right text-white text-sm font-mono font-semibold overflow-hidden" data-testid="units">
                  <div className="truncate">{fmtNumber(it.units)}</div>
                </div>
                <div className="col-span-2 text-right text-[#4a9eff] text-sm font-mono font-bold overflow-hidden" data-testid="revenue">
                  <div className="truncate">{fmtCurrency(it.revenue)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="sr-only">
          Tabular list of weekly sales facts with store, SKU, units, and revenue columns.
        </p>
      </div>
    </div>
  );
}
