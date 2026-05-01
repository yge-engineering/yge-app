// Global loading state — shown while server components fetch data.
//
// Plain English: the in-between screen during navigation. Replaces a
// blank white page with a YGE-branded "loading" card so users know
// something's happening.

export default function GlobalLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-700 text-sm font-bold text-white">
          YGE
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-700" />
          <span>Loading…</span>
        </div>
      </div>
    </main>
  );
}
