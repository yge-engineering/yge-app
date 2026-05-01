// 404 not-found page.
//
// Plain English: when someone hits a URL that doesn't exist, give
// them a friendly page instead of a generic Next.js error. Wrapped
// in AppShell so they keep their nav.

import Link from 'next/link';

import { AppShell } from '../components/app-shell';

export default function NotFound() {
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-amber-100 text-amber-800">
          <span className="text-xl font-bold">?</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          The URL you followed doesn&apos;t lead anywhere in this app. Either it&apos;s a typo or the page hasn&apos;t been built yet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Back to dashboard
          </Link>
          <Link
            href="/all-modules"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            See all modules
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
