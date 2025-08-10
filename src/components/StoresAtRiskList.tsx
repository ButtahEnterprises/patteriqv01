"use client";
import React from "react";
import { AlertTriangle, ShieldAlert, AlertOctagon } from "lucide-react";
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

export default function StoresAtRiskList({
  items,
  demoMode,
}: {
  items: RiskItem[] | null | undefined;
  demoMode?: boolean;
}) {
  const router = useRouter();
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
  // helpers
  const fmtPercent = (f: number) =>
    new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(f);

  const severity = (z: number) => (z <= -2 ? 2 : z <= -1.5 ? 1 : 0);
  const sorted = (items || []).slice().sort((a, b) => {
    const sa = severity(a.zScore);
    const sb = severity(b.zScore);
    if (sa !== sb) return sb - sa; // higher severity first
    if (a.zScore !== b.zScore) return a.zScore - b.zScore; // more negative first
    if (a.pctChange !== b.pctChange) return a.pctChange - b.pctChange; // bigger drop first
    return b.topSkuCount - a.topSkuCount;
  });

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
    <Card className="group transition-colors duration-200 hover:border-white/10" aria-busy={isLoading}>
      <CardHeader className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-white/80">Stores at Risk</div>
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
                  {sorted.map((it) => {
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
            </div>
          )}
        </PanelErrorBoundary>
      </CardContent>
    </Card>
  );
}
