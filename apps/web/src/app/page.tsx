import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-yge-blue-500">YGE App</h1>
        <p className="mt-2 text-sm uppercase tracking-wide text-gray-500">
          Young General Engineering, Inc.
        </p>
        <p className="mt-6 text-gray-700">
          Estimating, job management, and bookkeeping for heavy civil work. Replaces Excel + QuickBooks
          Online with a single connected system.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded bg-yge-blue-500 px-6 py-3 text-white hover:bg-yge-blue-700"
          >
            Open Dashboard
          </Link>
          <Link
            href="/plans-to-estimate"
            className="rounded bg-yge-blue-500 px-6 py-3 text-white hover:bg-yge-blue-700"
          >
            Plans-to-Estimate (AI)
          </Link>
          <Link
            href="/drafts"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Saved Drafts
          </Link>
          <Link
            href="/estimates"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Priced Estimates
          </Link>
          <Link
            href="/jobs"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            View Jobs
          </Link>
          <Link
            href="/crew"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Crew Roster
          </Link>
          <Link
            href="/tools"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Power Tools
          </Link>
          <Link
            href="/equipment"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Equipment
          </Link>
          <Link
            href="/daily-reports"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Daily Reports
          </Link>
          <Link
            href="/brand"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Brand kit
          </Link>
          <Link
            href="/bid-results"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Bid Results
          </Link>
          <Link
            href="/certificates"
            className="rounded border border-yge-blue-500 px-6 py-3 text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Certificates
          </Link>
        </div>
        <p className="mt-12 text-xs text-gray-400">
          Phase 1 MVP — under active development. See README.md and CLAUDE.md.
        </p>
      </div>
    </main>
  );
}
