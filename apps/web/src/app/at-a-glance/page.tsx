import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';
import { AtAGlancePanel } from './at-a-glance-panel';

export default function AtAGlancePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="At a glance"
          subtitle="Lifetime + today + this-month tiles, plus a curated jump list. Bookmark this as your home tab."
        />
        <AtAGlancePanel />
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Jump to</h2>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <Link href="/dashboard/morning-briefing" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Morning briefing</Link>
            <Link href="/dashboard/today" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Today</Link>
            <Link href="/dashboard/last-7-days" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Last 7 days</Link>
            <Link href="/dashboard/this-month" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">This month</Link>
            <Link href="/dashboard/this-quarter" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">This quarter</Link>
            <Link href="/portfolio" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Portfolio overview</Link>
            <Link href="/jobs/statuses" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Jobs by status</Link>
            <Link href="/bid-results/outcomes" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Bid result outcomes</Link>
            <Link href="/admin/data-quality-hub" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Data quality hub</Link>
            <Link href="/quick-tools" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">All analytic / utility pages</Link>
            <Link href="/sitemap" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">Full site map</Link>
            <Link href="/changelog" className="rounded border border-gray-200 bg-white p-2 hover:bg-gray-50">What's new</Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
