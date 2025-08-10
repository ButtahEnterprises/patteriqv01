import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-[#0C0F15] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/20 text-2xl mb-4">404</div>
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-white/70 mb-6">The page you are looking for doesn’t exist.</p>
        <Link href="/" className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm hover:bg-white/15">Go back home</Link>
      </div>
    </main>
  );
}
