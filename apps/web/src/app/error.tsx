'use client';

// Global error boundary.
//
// Plain English: when any page crashes (network error, bad data, etc.),
// Next.js renders this instead of a stack trace. We show a friendly
// message + the actual error message so the team can debug live, plus
// a retry button + a "go home" fallback.

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Page error:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-red-100 text-red-700">
          <span className="text-xl font-bold">!</span>
        </div>
        <h1 className="text-base font-semibold text-gray-900">
          Something broke on this page.
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          The error is logged. You can try again, or jump back to the dashboard.
        </p>

        {/* Show the actual error message so the team can debug live. */}
        {error?.message ? (
          <div className="mx-auto mt-4 max-w-xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
              Error
            </div>
            <pre className="mt-1 whitespace-pre-wrap break-words text-left text-xs text-red-900">
              {error.message}
            </pre>
          </div>
        ) : null}

        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-gray-400">
            Error ID: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
