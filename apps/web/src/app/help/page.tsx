import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

interface FAQ { q: string; a: React.ReactNode }

const FAQS: FAQ[] = [
  {
    q: 'How do I record a new bid result?',
    a: (
      <>
        Go to <Link href="/bid-results/new" className="text-yge-blue-700 hover:underline">/bid-results/new</Link>{' '}
        and fill in the bidder list. You can paste a multi-bidder agency tabulation directly into the form.
      </>
    ),
  },
  {
    q: 'How do I bulk-import customers / vendors / materials?',
    a: (
      <>
        Visit the{' '}
        <Link href="/admin/csv-imports" className="text-yge-blue-700 hover:underline">CSV imports hub</Link>{' '}
        and pick the importer for that data type. Each importer supports a dry-run with row-level error reporting before any writes happen.
      </>
    ),
  },
  {
    q: 'Where do I download a starter template?',
    a: (
      <>
        Every importer page has a 'Download starter CSV' link at the top. You can also export the current data table from the{' '}
        <Link href="/admin/csv-exports" className="text-yge-blue-700 hover:underline">CSV exports hub</Link>.
      </>
    ),
  },
  {
    q: 'How do I see active jobs?',
    a: (
      <>
        The <Link href="/jobs/active" className="text-yge-blue-700 hover:underline">Active jobs</Link> page lists every job currently in AWARDED or BID_SUBMITTED status. Use <Link href="/jobs/board" className="text-yge-blue-700 hover:underline">Pipeline board</Link> for a kanban view.
      </>
    ),
  },
  {
    q: 'How is win rate calculated?',
    a: (
      <>Win rate counts only decided bids (won + lost). NO_AWARD and TBD outcomes are excluded so the percentage isn't dragged down by pending tabs.</>
    ),
  },
  {
    q: 'Where do I see all the analytic pages at once?',
    a: (
      <>
        The <Link href="/quick-tools" className="text-yge-blue-700 hover:underline">Quick tools</Link> page indexes every analytic + utility view across the app in one flat list.
      </>
    ),
  },
];

export default function HelpPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Help" subtitle="Common questions and where to find things in the YGE app." />
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer font-semibold text-gray-900">{f.q}</summary>
              <div className="mt-2 text-sm text-gray-700">{f.a}</div>
            </details>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
