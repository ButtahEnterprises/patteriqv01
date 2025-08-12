"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader } from "./ui/card";

export type DataHealthPoint = {
  isoWeek: string;
  totalStores: number;
  pseudoStores: number;
  pctFullAllocated: number; // 0..100
};

function fmtPercentWhole(n: number) {
  return `${n.toFixed(1)}%`;
}

// Local error boundary
class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
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
        <div className="h-[220px] flex items-center justify-center text-rose-300 text-sm">
          Data health unavailable
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default function DataHealthCard({
  data,
  demoMode,
  issues,
}: {
  data: DataHealthPoint[] | null | undefined;
  demoMode?: boolean;
  issues?: string[];
}) {
  const isLoading = data == null;
  const latest = (data && data.length > 0) ? data[data.length - 1] : undefined;
  const [revealed, setRevealed] = React.useState(false);
  React.useEffect(() => {
    if (isLoading) {
      setRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [isLoading, data]);

  // Color rules for markers
  const dotColor = (v: number) => {
    if (v >= 100) return "#34d399"; // green when fully allocated
    if (v >= 90) return "#fde047"; // yellow for 90–<100%
    return "#f87171"; // red for <90%
  };

  type DotProps = { cx?: number; cy?: number; payload?: DataHealthPoint };
  const CustomDot: React.FC<DotProps> = (props) => {
    const { cx = 0, cy = 0, payload } = props;
    const v = payload?.pctFullAllocated ?? 0;
    // Show dot for all points, color-coded
    return (
      <circle cx={cx} cy={cy} r={3.5} fill={dotColor(v)} stroke="#0f172a" strokeWidth={1} />
    );
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#1e3a5f] to-[#0f1419] border border-[#4a9eff]/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Data Health</h3>
          <p className="text-sm text-white/70">% Allocation — last {data?.length} weeks</p>
        </div>
        <div className="flex items-center gap-2">
          {latest ? (
            <div className="text-xl sm:text-2xl font-semibold text-white/90 font-mono" aria-label="Latest allocation">
              {fmtPercentWhole(latest.pctFullAllocated)}
            </div>
          ) : null}
          {demoMode ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 text-[11px]">
              Demo Data
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 text-white/70 border border-white/15 px-2.5 py-0.5 text-[11px]">
              Live
            </span>
          )}
        </div>
      </div>
      <div>

      {/* Non-blocking issues/warnings */}
      {Array.isArray(issues) && issues.length > 0 ? (
        <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-200 px-3 py-2 text-[12px]">
          <div className="font-medium mb-1">Data issues detected ({issues.length})</div>
          <ul className="list-disc list-inside space-y-0.5">
            {issues.slice(0, 3).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
          {issues.length > 3 ? (
            <div className="mt-1 text-amber-200/80">…and {issues.length - 3} more</div>
          ) : null}
        </div>
      ) : null}

      <PanelErrorBoundary>
        {isLoading ? (
          <div className="h-[220px] rounded-xl bg-white/5 animate-pulse" aria-hidden="true" />
        ) : data && data.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-white/60 text-sm">
            {demoMode ? "No data available in current mode" : "Data health unavailable"}
          </div>
        ) : (
          <div className={`h-[220px] transition-all duration-300 ease-out ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#2a3142" strokeDasharray="3 3" />
                <XAxis
                  dataKey="isoWeek"
                  stroke="#9aa3b2"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="#9aa3b2"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                  label={{ value: "Allocation (%)", angle: -90, position: "insideLeft", fill: "#9aa3b2" }}
                />
                <ReferenceLine y={90} stroke="#fde047" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{ background: "#12161f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  labelStyle={{ color: "#cbd5e1" }}
                  labelFormatter={(label: string | number) => `Week ${label}`}
                  formatter={(value: unknown, _name: unknown, item: { payload?: DataHealthPoint } | undefined) => {
                    const p = item?.payload;
                    return [
                      fmtPercentWhole(Number(value as number)),
                      `Allocated (${(p?.totalStores ?? 0) - (p?.pseudoStores ?? 0)}/${p?.totalStores ?? 0} stores)`
                    ];
                  }}
                />
                <Line type="monotone" dataKey="pctFullAllocated" name="Allocation" stroke="#34d399" strokeWidth={2} dot={<CustomDot />} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelErrorBoundary>

      {/* Accessible numeric table for screen readers */}
      <div className="sr-only" aria-hidden={false}>
        <p id="data-health-desc">Table of weekly allocation percentages for the last 12 weeks.</p>
        <table aria-describedby="data-health-desc">
          <thead>
            <tr>
              <th>ISO Week</th>
              <th>% Allocated</th>
              <th>Total Stores</th>
              <th>Pseudo Stores</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((d) => (
              <tr key={d.isoWeek}>
                <td>{d.isoWeek}</td>
                <td>{fmtPercentWhole(d.pctFullAllocated)}</td>
                <td>{d.totalStores}</td>
                <td>{d.pseudoStores}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
