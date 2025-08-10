export type KPI = { label: string; value: string | number; note?: string; };
export type WeeklySummary = { week: string; tenant: string; kpis: KPI[]; };

export const demoConfig = {
  demoMode: process.env.DEMO_MODE === "true",
  defaultTenant: process.env.DEFAULT_TENANT || "Demo Tenant",
} as const;

export const demoWeeklySummary: WeeklySummary = {
  week: "2025-W32",
  tenant: demoConfig.defaultTenant,
  kpis: [
    { label: "Total Sales — This Week", value: "$244,700", note: "vs last week (WoW)" },
    { label: "Units Sold — This Week", value: 15600, note: "vs last week (WoW)" },
    { label: "Active SKUs — This Week", value: 5, note: "vs last week (WoW)" },
    { label: "Active Stores — This Week", value: 0, note: "vs last week (WoW)" },
  ],
};
