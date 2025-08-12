import React from "react";

export default function LoadingDashboardSkeleton() {
  return (
    <main>
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-5 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
            <div>
              <div className="h-6 w-56 rounded bg-white/10" />
              <div className="h-3 w-80 rounded bg-white/10 mt-2" />
              <div className="flex gap-2 mt-3">
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/10" />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-6 w-28 rounded bg-white/10" />
              <div className="h-6 w-28 rounded bg-white/10" />
              <div className="h-6 w-28 rounded bg-white/10" />
              <div className="h-8 w-48 rounded bg-white/10" />
              <div className="h-8 w-28 rounded bg-white/10" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-white/10" />
                <div className="h-3 w-32 rounded bg-white/10" />
              </div>
              <div className="h-8 w-40 rounded bg-white/10" />
              <div className="h-3 w-24 rounded bg-white/10 mt-2" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-6 sm:mt-8">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/5 h-[320px]" />
          ))}
        </div>

        <div className="mt-6 sm:mt-8">
          <div className="rounded-2xl border border-white/5 bg-white/5 h-[220px]" />
        </div>

        <div className="mt-6 sm:mt-8">
          <div className="rounded-2xl border border-white/5 bg-white/5 h-[420px]" />
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 mt-6 sm:mt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/5 h-[360px]" />
          ))}
        </div>

        <div className="mt-6 sm:mt-8">
          <div className="rounded-2xl border border-white/5 bg-white/5 h-[300px]" />
        </div>
      </div>
    </main>
  );
}
