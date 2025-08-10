type Level = "debug" | "info" | "warn" | "error";

function ts() {
  return new Date().toISOString();
}

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line = `[${ts()}] ${level.toUpperCase()} ${msg}`;
  if (meta) {
    console[level === "debug" ? "log" : level](line, meta);
  } else {
    console[level === "debug" ? "log" : level](line);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
};

export type LogCtx = { rid?: string; ms?: number; [k: string]: unknown };
