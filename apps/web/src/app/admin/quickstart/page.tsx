import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';

export default function QuickstartPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Quickstart" subtitle="Five things to do in your first ten minutes." />

        <ol className="space-y-3">
          <li className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">1. Open At a glance</h2>
            <p className="mt-1 text-sm text-gray-700">
              <Link href="/at-a-glance" className="text-yge-blue-700 hover:underline">/at-a-glance</Link>{' '}
              is the command center. Lifetime stats + this-month tiles + pipeline counts on one page.
            </p>
          </li>
          <li className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">2. Skim the portfolio</h2>
            <p className="mt-1 text-sm text-gray-700">
              <Link href="/portfolio" className="text-yge-blue-700 hover:underline">/portfolio</Link>{' '}
              shows lifetime wins, today's pipeline, and master-data record counts side by side.
            </p>
          </li>
          <li className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">3. See what's there</h2>
            <p className="mt-1 text-sm text-gray-700">
              <Link href="/sitemap" className="text-yge-blue-700 hover:underline">/sitemap</Link>{' '}
              indexes every page in the app, organized by area. Bookmark it.
            </p>
          </li>
          <li className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">4. Run a routine</h2>
            <p className="mt-1 text-sm text-gray-700">
              <Link href="/help/cheatsheet" className="text-yge-blue-700 hover:underline">/help/cheatsheet</Link>{' '}
              walks through the daily, weekly, bid-night, and quarterly routines.
            </p>
          </li>
          <li className="rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">5. Browse the grand index</h2>
            <p className="mt-1 text-sm text-gray-700">
              <Link href="/admin/grand-index" className="text-yge-blue-700 hover:underline">/admin/grand-index</Link>{' '}
              is the comprehensive catalog of every hub, dashboard, and admin tool.
            </p>
          </li>
        </ol>
      </main>
    </AppShell>
  );
}
