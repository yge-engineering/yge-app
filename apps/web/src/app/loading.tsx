// Global loading state — shown while server components fetch data.
//
// Plain English: the in-between screen during navigation. Replaces a
// blank white page with a YGE-branded "loading" card so users know
// something's happening.

export default function GlobalLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <img
          src="/yge-logo.jpg"
          alt="Young General Engineering"
          className="mx-auto mb-3 h-20 w-auto"
        />
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-800" />
          <span>Loading…</span>
        </div>
      </div>
    </main>
  );
}
