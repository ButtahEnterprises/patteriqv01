"use client";
import React from "react";
import { AlertTriangle, ShieldAlert, AlertOctagon, HelpCircle, ExternalLink, Download, X, TrendingDown, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "./ui/table";

export type RiskItem = {
  storeId: number;
  storeName: string;
  zScore: number;
  pctChange: number; // WoW
  topSkuCount: number;
};

export default function StoresAtRiskList({ items, demoMode }: { items: RiskItem[] | null | undefined, demoMode?: boolean }) {
  const router = useRouter();
  const isLoading = items == null;
  const [revealed, setRevealed] = React.useState(false);
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const [selectedStore, setSelectedStore] = React.useState<RiskItem | null>(null);
  const [showAllStores, setShowAllStores] = React.useState(false);
  const [storeDetails, setStoreDetails] = React.useState<any>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);

  React.useEffect(() => {
    if (isLoading) {
      setRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [isLoading, items]);
  // helpers
  const fmtPercent = (f: number) =>
    new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(f);

  const severity = (z: number) => (z <= -2 ? 2 : z <= -1.5 ? 1 : 0);

  // Function to fetch detailed store breakdown
  const fetchStoreDetails = async (storeId: number) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/breakdown`);
      if (response.ok) {
        const data = await response.json();
        setStoreDetails(data);
      } else {
        setStoreDetails({ error: 'Failed to load store details' });
      }
    } catch (error) {
      setStoreDetails({ error: 'Error loading store details' });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle store row click for detailed breakdown
  const handleStoreClick = (store: RiskItem, event: React.MouseEvent) => {
    // Check if the click was on the external link area
    const target = event.target as HTMLElement;
    if (target.closest('[data-external-link]')) {
      router.push(`/store/${store.storeId}`);
      return;
    }
    
    // Otherwise show detailed breakdown modal
    setSelectedStore(store);
    setShowDetailModal(true);
    fetchStoreDetails(store.storeId);
  };
  const sorted = (items || []).sort((a, b) => {
    const sa = a.zScore <= -2 ? 2 : a.zScore <= -1.5 ? 1 : 0;
    const sb = b.zScore <= -2 ? 2 : b.zScore <= -1.5 ? 1 : 0;
    if (sa !== sb) return sb - sa; // higher severity first
    if (a.zScore !== b.zScore) return a.zScore - b.zScore; // more negative first
    if (a.pctChange !== b.pctChange) return a.pctChange - b.pctChange; // bigger drop first
    return b.topSkuCount - a.topSkuCount;
  });

  // Limit to 5 rows by default, show all if expanded
  const displayedItems = showAllStores ? sorted : sorted.slice(0, 5);
  const hasMoreItems = sorted.length > 5;

  // Local error boundary
  class PanelErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
      return { hasError: true };
    }
    render() {
      if (this.state.hasError) {
        return (
          <div className="h-[300px] flex items-center justify-center text-rose-300 text-sm">
            Failed to render stores list. Please refresh.
          </div>
        );
      }
      return this.props.children;
    }
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-slate-700/50 shadow-xl shadow-black/20 p-6 min-h-[420px] max-h-[500px] transition-all duration-300 hover:shadow-2xl hover:shadow-black/30 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-gradient-to-b from-red-500 to-orange-500 rounded-full shadow-sm"></div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">Stores at Risk</h3>
            <div className="relative group">
              <HelpCircle className="h-4 w-4 text-blue-500 cursor-help hover:text-blue-600 transition-colors" />
              <div className="absolute left-0 top-6 w-80 p-4 bg-white/95 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl shadow-black/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-10">
                <div className="text-sm text-slate-700 space-y-2">
                  <div className="font-semibold text-blue-600">Risk Assessment Logic:</div>
                  <div><strong>Z-Score:</strong> Statistical deviation from average performance</div>
                  <div><strong>High Risk:</strong> Z-Score ≤ -2.0 (2+ std dev below avg)</div>
                  <div><strong>Medium Risk:</strong> Z-Score ≤ -1.5 (1.5-2 std dev below avg)</div>
                  <div><strong>Low Risk:</strong> Z-Score &gt; -1.5</div>
                  <div className="pt-2 border-t border-slate-200">
                    <strong>Sorting:</strong> Highest severity → Most negative z-score → Biggest revenue drop → Highest SKU count
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {demoMode ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[11px]">
            Demo Data
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/70 border border-white/15 px-2.5 py-0.5 text-[11px]">
            Live
          </span>
        )}
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500/15 to-orange-500/15 text-red-600 border border-red-200/60 px-4 py-2 text-xs font-semibold backdrop-blur-sm">
          {(items || []).filter(item => item.zScore <= -2.0).length} Critical
        </span>
      </div>
      <div className="flex-1 flex flex-col">
        <PanelErrorBoundary>
          {isLoading ? (
            <div className="h-[300px] rounded-xl bg-white/5 animate-pulse" aria-hidden="true" />
          ) : items && items.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-white/60 text-sm" data-testid="stores-at-risk-empty">
              {demoMode ? "No risk data available in current mode" : "No stores at risk yet. Waiting for ingestion..."}
            </div>
          ) : (
            <div className={`overflow-x-auto transition-all duration-300 ease-out ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
              <Table className="min-w-full" data-testid="stores-at-risk-table">
                <TableHeader>
                  <tr className="text-white/60 text-xs sm:text-sm">
                    <TableHead className="text-left font-medium py-2.5 sm:py-3 pr-3">Store Name</TableHead>
                    <TableHead className="text-right font-medium py-2.5 sm:py-3 px-3">Δ Revenue vs prior week</TableHead>
                    <TableHead className="text-right font-medium py-2.5 sm:py-3 px-3">Z-score</TableHead>
                    <TableHead className="text-right font-medium py-2.5 sm:py-3 px-3">SKU Count</TableHead>
                    <TableHead className="text-right font-medium py-2.5 sm:py-3 pl-3">Risk</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {displayedItems.map((it) => {
                    const wowColor = it.pctChange < 0 ? "text-rose-300" : "text-emerald-300";
                    const zColor = it.zScore < 0 ? "text-rose-300" : "text-emerald-300";
                    let riskLabel = "At Risk";
                    let riskClass = "bg-rose-500/15 text-rose-300 border-rose-500/30";
                    let RiskIcon: React.ElementType = ShieldAlert;
                    if (it.zScore <= -2) {
                      riskLabel = "High Risk";
                      riskClass = "bg-rose-600/20 text-rose-200 border-rose-600/35";
                      RiskIcon = AlertOctagon;
                    } else if (it.zScore <= -1.5) {
                      riskLabel = "Moderate";
                      riskClass = "bg-amber-500/15 text-amber-200 border-amber-500/30";
                      RiskIcon = AlertTriangle;
                    }
                    return (
                      <TableRow
                        key={it.storeId}
                        className="group border-t border-white/5 hover:bg-white/5 hover:border-white/10 cursor-pointer transition-colors focus-visible:bg-white/5 outline-none"
                        data-testid="store-row"
                        data-store-id={it.storeId}
                        tabIndex={0}
                        role="button"
                        aria-label={`View details for ${it.storeName}`}
                        onClick={() => {
                          router.push(`/store/${it.storeId}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/store/${it.storeId}`);
                          }
                        }}
                      >
                        <TableCell className="py-2.5 sm:py-3 pr-3">
                          <div className="text-white/90">{it.storeName}</div>
                          <div className="text-[11px] text-white/60">ID: {it.storeId}</div>
                        </TableCell>
                        <TableCell className={`py-2.5 sm:py-3 px-3 text-right font-mono ${wowColor}`}>
                          <span aria-hidden>{it.pctChange < 0 ? "▼" : "▲"}</span>
                          <span className="sr-only">{it.pctChange < 0 ? "Decrease" : "Increase"} </span>
                          <span className="ml-1">{fmtPercent(it.pctChange)}</span>
                        </TableCell>
                        <TableCell className={`py-2.5 sm:py-3 px-3 text-right font-mono ${zColor}`}>{it.zScore.toFixed(2)}</TableCell>
                        <TableCell className="py-2.5 sm:py-3 px-3 text-right text-white/85">{it.topSkuCount}</TableCell>
                        <TableCell className="py-2.5 sm:py-3 pl-3 text-right">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-transform ${riskClass}`}>
                            <RiskIcon className="h-3.5 w-3.5" />
                            {riskLabel}
                            <span className="ml-2 opacity-0 transition-opacity duration-150 group-hover:opacity-60" aria-hidden>
                              ›
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {hasMoreItems && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowAllStores(!showAllStores)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:text-white transition-all duration-200 text-sm font-medium"
                  >
                    {showAllStores ? (
                      <>
                        Show Less
                        <TrendingUp className="h-4 w-4 rotate-180" />
                      </>
                    ) : (
                      <>
                        Show All {sorted.length} Stores
                        <TrendingDown className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </PanelErrorBoundary>
      </div>
    </div>
  );
}
