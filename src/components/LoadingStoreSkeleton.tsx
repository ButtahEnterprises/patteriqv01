"use client";

import React from "react";

export default function LoadingStoreSkeleton() {
  return (
    <main>
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/5 animate-pulse" />
              <div>
                <div className="h-6 w-48 rounded bg-white/10 animate-pulse" />
                <div className="h-4 w-64 mt-2 rounded bg-white/5 animate-pulse" />
              </div>
            </div>
            <div className="h-8 w-72 rounded bg-white/5 animate-pulse" />
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="h-[360px] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          <div className="h-[360px] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        </div>
      </div>
    </main>
  );
}
