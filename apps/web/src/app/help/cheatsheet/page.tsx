import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';

export default function CheatsheetPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="One-page cheat sheet" subtitle="Print this and tape it to your monitor." />

        <div className="space-y-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <section>
            <h2 className="text-sm font-semibold text-gray-900">Daily routine</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/at-a-glance" className="text-yge-blue-700 hover:underline">/at-a-glance</Link> — start your morning here</li>
              <li><Link href="/jobs/today" className="text-yge-blue-700 hover:underline">/jobs/today</Link> — what we touched today</li>
              <li><Link href="/bid-results/tbd" className="text-yge-blue-700 hover:underline">/bid-results/tbd</Link> — bids still awaiting outcome</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Weekly routine</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/dashboard/last-7-days" className="text-yge-blue-700 hover:underline">/dashboard/last-7-days</Link> — week-over-week recap</li>
              <li><Link href="/vendors/coi-aging" className="text-yge-blue-700 hover:underline">/vendors/coi-aging</Link> — chase expiring COIs</li>
              <li><Link href="/admin/data-quality-counts" className="text-yge-blue-700 hover:underline">/admin/data-quality-counts</Link> — cleanup buckets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Bid-night routine</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/bid-results/new" className="text-yge-blue-700 hover:underline">/bid-results/new</Link> — record every bidder + amount</li>
              <li><Link href="/bid-results/today" className="text-yge-blue-700 hover:underline">/bid-results/today</Link> — what closed today</li>
              <li><Link href="/bid-results/biggest-wins" className="text-yge-blue-700 hover:underline">/bid-results/biggest-wins</Link> — celebrate the big ones</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Quarterly routine</h2>
            <ul className="ml-6 list-disc text-sm text-gray-700">
              <li><Link href="/dashboard/this-quarter" className="text-yge-blue-700 hover:underline">/dashboard/this-quarter</Link> — quarterly snapshot</li>
              <li><Link href="/bid-results/by-quarter" className="text-yge-blue-700 hover:underline">/bid-results/by-quarter</Link> — win-rate trend</li>
              <li><Link href="/admin/csv-exports" className="text-yge-blue-700 hover:underline">/admin/csv-exports</Link> — snapshot the master tables</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900">Anywhere search</h2>
            <p className="text-sm text-gray-700">
              The <Link href="/sitemap" className="text-yge-blue-700 hover:underline">sitemap</Link>
              {' '}lists every page. <Link href="/quick-tools" className="text-yge-blue-700 hover:underline">quick-tools</Link>
              {' '}is the analytic index. <Link href="/admin/quick-links" className="text-yge-blue-700 hover:underline">admin quick links</Link>
              {' '}gathers every admin tool.
            </p>
          </section>
        </div>

        <p className="mt-4 text-xs text-gray-500">Tip: Cmd-P / Ctrl-P prints this page.</p>
      </main>
    </AppShell>
  );
}
