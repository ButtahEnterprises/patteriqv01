import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { headers } from "next/headers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PatternIQ",
  description: "AI-Assisted Retail Intelligence Dashboard",
};

// Ensure this layout is rendered dynamically since it depends on request headers and cookies
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;
  const cookie = h.get("cookie") ?? "";
  // Fetch config defensively to avoid build-time prerender failures
  let cfg: { demoMode: boolean } = { demoMode: true };
  try {
    const cfgRes = await fetch(`${base}/api/config`, { cache: "no-store", headers: { cookie } });
    if (cfgRes.ok) {
      const ct = cfgRes.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        cfg = await cfgRes.json();
      }
    }
  } catch {
    // ignore and use default demo config during prerender
  }
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-dvh bg-[#0C0F15] text-white">
          <div className="px-6 py-6 border-b border-white/5 bg-gradient-to-b from-[#0F131B] to-transparent">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="text-2xl font-semibold rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 px-1">
                  PatternIQ
                </Link>
                <nav className="flex items-center gap-4 text-sm text-white/80">
                  <Link href="/" className="rounded-md px-2 py-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                    Dashboard
                  </Link>
                  <Link href="/ingest" className="rounded-md px-2 py-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                    Ingest
                  </Link>
                  <Link href="/examples" className="rounded-md px-2 py-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30">
                    Examples
                  </Link>
                </nav>
              </div>
              <div className="flex items-center gap-3">

                {cfg.demoMode && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs" role="status" aria-live="polite" title="Demo Mode">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Demo Mode • Local Data
                    <span className="sr-only">Demo mode is enabled</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
