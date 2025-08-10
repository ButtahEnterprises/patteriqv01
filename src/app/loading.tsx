export default function Loading() {
  return (
    <main className="min-h-dvh bg-[#0C0F15] text-white" aria-busy="true">
      <div className="px-6 py-6 border-b border-white/5 bg-gradient-to-b from-[#0F131B] to-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="space-y-2" aria-hidden="true">
            <div className="h-6 w-64 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-4 w-80 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="h-7 w-28 rounded-full bg-white/10 border border-white/15 animate-pulse" />
            <div className="h-7 w-36 rounded-full bg-white/10 border border-white/15 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-6 mb-8" aria-hidden="true">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-2">
              <div className="h-5 w-56 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-72 rounded bg-white/10 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-36 rounded-xl bg-white/10 border border-white/10 animate-pulse" />
              <div className="h-7 w-40 rounded-xl bg-white/10 border border-white/10 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 shadow" aria-hidden="true">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 animate-pulse" />
                <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
              </div>
              <div className="h-8 w-28 rounded bg-white/10 animate-pulse" />
              <div className="mt-2 h-3 w-36 rounded bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>

        <div className="grid gap-5 grid-cols-1 lg:grid-cols-2 mt-8">
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 shadow h-[360px]" aria-hidden="true">
            <div className="h-5 w-24 rounded bg-white/10 animate-pulse mb-3" />
            <div className="h-[300px] rounded-xl bg-white/5 animate-pulse" />
          </div>
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 shadow h-[360px]" aria-hidden="true">
            <div className="h-5 w-28 rounded bg-white/10 animate-pulse mb-3" />
            <div className="h-[300px] rounded-xl bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}
