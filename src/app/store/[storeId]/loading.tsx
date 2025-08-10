export default function Loading() {
  return (
    <main aria-busy="true">
      <div className="max-w-7xl mx-auto px-6 py-6 sm:py-8" aria-hidden="true">
        <div className="mb-4 h-5 w-40 bg-white/10 rounded animate-pulse" />
        <div className="rounded-2xl bg-gradient-to-br from-[#151925] to-[#0F131C] border border-white/5 p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-48 bg-white/10 rounded animate-pulse" />
              <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 sm:p-6">
            <div className="h-64 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="rounded-2xl bg-gradient-to-b from-[#1B1E28] to-[#141720] border border-white/5 p-5 sm:p-6">
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
