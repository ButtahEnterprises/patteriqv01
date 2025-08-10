export type DemoTrendPoint = {
  isoWeek: string;
  revenue: number;
  units: number;
};

// 12-week demo series, oldest -> newest
export const demoTrendData: DemoTrendPoint[] = [
  { isoWeek: "2025-W01", revenue: 120_000, units: 5200 },
  { isoWeek: "2025-W02", revenue: 128_500, units: 5450 },
  { isoWeek: "2025-W03", revenue: 131_200, units: 5520 },
  { isoWeek: "2025-W04", revenue: 126_800, units: 5380 },
  { isoWeek: "2025-W05", revenue: 135_000, units: 5650 },
  { isoWeek: "2025-W06", revenue: 138_400, units: 5740 },
  { isoWeek: "2025-W07", revenue: 142_900, units: 5900 },
  { isoWeek: "2025-W08", revenue: 145_300, units: 6000 },
  { isoWeek: "2025-W09", revenue: 149_800, units: 6120 },
  { isoWeek: "2025-W10", revenue: 152_400, units: 6210 },
  { isoWeek: "2025-W11", revenue: 158_700, units: 6400 },
  { isoWeek: "2025-W12", revenue: 161_200, units: 6480 },
];
