"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader } from "./ui/card";

export type TrendPoint = {
  isoWeek: string;
  revenue: number;
  units: number;
};

// Formatting helpers
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtUnits = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

// Simple panel error boundary to show a friendly error state
class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: unknown) {
    const message = err instanceof Error ? err.message : "Render error";
    return { hasError: true, message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[300px] flex items-center justify-center text-rose-300 text-sm">
          Failed to render chart. Please refresh.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function KpiTrendChart({
  data,
  demoMode,
}: {
  data: TrendPoint[] | null | undefined;
  demoMode?: boolean;
}) {
  const isLoading = data == null;
  const [revealed, setRevealed] = React.useState(false);
  React.useEffect(() => {
    if (isLoading) {
      setRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [isLoading, data]);
  return (
    <Card
      className="group h-[360px] transition-colors duration-200 hover:border-white/10"
      role="figure"
      aria-label="KPI Trend chart"
      aria-busy={isLoading}
      data-testid="kpi-trend-chart"
      data-point-count={(Array.isArray(data) ? data.length : 0) as unknown as number}
    >
      <CardHeader className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-white/80">KPI Trend</div>
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
            <div className="h-[300px] rounded-xl bg-white/5 animate-pulse" aria-hidden="true" data-testid="trend-skeleton" />
          ) : (data && data.length === 0 && !demoMode) ? (
            <div className="h-[300px] flex items-center justify-center text-white/60 text-sm" data-testid="trend-empty">
              No trend data yet. Waiting for ingestion...
            </div>
          ) : (
            <div className={`h-[300px] transition-all duration-300 ease-out ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="isoWeek"
                    stroke="#9aa3b2"
                    tick={{ fontSize: 12 }}
                    label={{ value: "Week", position: "insideBottom", offset: -5, fill: "#9aa3b2" }}
                  />
                  <YAxis
                    yAxisId="revenue"
                    stroke="#9aa3b2"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => fmtCurrency(v)}
                    label={{ value: "Revenue ($)", angle: -90, position: "insideLeft", fill: "#9aa3b2" }}
                  />
                  <YAxis
                    yAxisId="units"
                    orientation="right"
                    stroke="#9aa3b2"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => fmtUnits(v)}
                    label={{ value: "Units", angle: -90, position: "insideRight", fill: "#9aa3b2" }}
                  />
                  <Tooltip
                    contentStyle={{ background: "#12161f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                    labelStyle={{ color: "#cbd5e1" }}
                    labelFormatter={(label: string | number) => `Week ${label}`}
                    formatter={(value: unknown, name: unknown) => {
                      const n = Number(value as number);
                      if (name === "Revenue") return [fmtCurrency(n), "Revenue ($)"];
                      if (name === "Units Sold") return [fmtUnits(n), "Units"];
                      return [String(value), String(name)];
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#cbd5e1" }} />
                  <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#facc15" strokeWidth={2} dot={false} />
                  <Line yAxisId="units" type="monotone" dataKey="units" name="Units Sold" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </PanelErrorBoundary>
        <p className="sr-only">Line chart showing weekly revenue and units trends.</p>
      </CardContent>
    </Card>
  );
}
