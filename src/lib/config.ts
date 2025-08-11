// Centralized configuration for PatternIQ
// - Sourced from environment variables where applicable
// - Safe defaults for local/demo usage

export const DEFAULT_TENANT: string = process.env.DEFAULT_TENANT || "Demo Tenant";

// Toggle demo mode via env; defaults to true for local development/demo
export const DEMO_MODE: boolean = (process.env.DEMO_MODE ?? "true").toLowerCase() === "true";

// Whether APIs should use the database by default (may be overridden by session demo mode)
export const USE_DB: boolean = (process.env.USE_DB ?? "true").toLowerCase() === "true";

export const RISK_THRESHOLD = {
  zScore: -1.0,
  pctDrop: 0.2,
  lookbackWeeks: 8,
};

// Dynamic getters for request-time evaluation (avoid import-time capture)
export function getDemoModeEnv(): boolean {
  return (process.env.DEMO_MODE ?? "true").toLowerCase() === "true";
}

export function getUseDbEnv(): boolean {
  return (process.env.USE_DB ?? "true").toLowerCase() === "true";
}
