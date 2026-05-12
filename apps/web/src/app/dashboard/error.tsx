'use client';

// Dashboard-specific error boundary.

import { useEffect } from 'react';
import Link from 'next/link';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? '';
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[/dashboard] error:', error);

    // Beacon to /admin/errors so we can correlate with Vercel runtime logs.
    try {
      const base = apiBaseUrl();
      if (base) {
        void fetch(`${base}/api/admin/errors/log-client`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            digest: error.digest ?? null,
            message: error.message ?? null,
            stack: error.stack ?? null,
            url: typeof window !== 'undefined' ? window.location.href : '/dashboard',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          }),
          keepalive: true,
        }).catch(() => {
          /* swallow */
        });
      }
    } catch {
      /* swallow */
    }
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-red-100 text-red-700">
            <span className="text-xl font-bold">!</span>
          </div>
          <h1 className="text-base font-semibold text-gray-900">
            Dashboard couldn&apos;t load.
          </h1>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          One of the dashboard tiles is throwing on render. The full
          app is fine — use the links below to jump to a working page.
        </p>

        {error?.message ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
              Error
            </div>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-red-900">
              {error.message}
            </pre>
          </div>
        ) : null}

        {error.digest ? (
          <p className="mb-4 font-mono text-[11px] text-gray-500">
            Error ID: {error.digest}
          </p>
        ) : null}

        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Try again
          </button>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            Jump to a working page
          </p>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <li><Link href="/reports" className="text-sm text-yge-blue-700 hover:underline">→ Reports directory</Link></li>
            <li><Link href="/morning-briefing" className="text-sm text-yge-blue-700 hover:underline">→ Morning briefing</Link></li>
            <li><Link href="/risk-register" className="text-sm text-yge-blue-700 hover:underline">→ Risk register</Link></li>
            <li><Link href="/cash-position" className="text-sm text-yge-blue-700 hover:underline">→ Cash position</Link></li>
            <li><Link href="/aging" className="text-sm text-yge-blue-700 hover:underline">→ AR + AP aging</Link></li>
            <li><Link href="/jobs" className="text-sm text-yge-blue-700 hover:underline">→ Jobs</Link></li>
            <li><Link href="/estimates" className="text-sm text-yge-blue-700 hover:underline">→ Estimates</Link></li>
            <li><Link href="/admin/errors" className="text-sm text-yge-blue-700 hover:underline">→ Admin: errors</Link></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
