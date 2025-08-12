"use client";

import React from "react";
import { ArrowLeft, Store as StoreIcon } from "lucide-react";
import Link from "next/link";
import Breadcrumbs from "./Breadcrumbs";
import WeekPicker from "./WeekPicker";
import KpiTrendChart from "./KpiTrendChart";
import StoreSkuBreakdown from "./StoreSkuBreakdown";

export type StorePageProps = {
  title: string;
  location?: string;
  selectedWeek: string;
  weeksWindow: number;
  trend: Array<{ isoWeek: string; revenue: number; units: number }> | null | undefined;
  breakdownItems: Array<{ skuId: number; skuName: string; brand?: string; revenue: number; units: number }> | null | undefined;
  cfgDemo: boolean;
  weekIso?: string | null;
};

export default function ClientStorePage({
  title,
  location,
  selectedWeek,
  weeksWindow,
  trend,
  breakdownItems,
  cfgDemo,
  weekIso,
}: StorePageProps) {
  return (
    <main>
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
                <StoreIcon className="h-5 w-5 text-teal-300" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-semibold" data-testid="store-title">{title}</div>
                <div className="text-white/60 text-xs sm:text-sm" data-testid="store-subtitle">
                  {location || "Location Unknown"}
                  {weekIso ? ` • Week ${weekIso}` : ""}
                </div>
                <Breadcrumbs
                  className="mt-2"
                  items={[
                    { label: "Dashboard", href: "/" },
                    { label: title },
                    { label: selectedWeek && selectedWeek !== "latest" ? `Week ${selectedWeek}` : `Week latest`, srLabel: "selected week" },
                    { label: `Last ${weeksWindow}`, srLabel: "weeks window" },
                  ]}
                />
              </div>
            </div>
            <WeekPicker />
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 sm:p-6">
            <div className="text-sm text-white/70 mb-3">{weeksWindow}-Week Revenue & Units</div>
            <KpiTrendChart data={trend ?? []} demoMode={cfgDemo} />
          </div>
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 sm:p-6">
            <div className="text-sm text-white/70 mb-3">Latest Week SKU Breakdown</div>
            <StoreSkuBreakdown items={breakdownItems ?? []} demoMode={cfgDemo} />
          </div>
        </div>
      </div>
    </main>
  );
}
