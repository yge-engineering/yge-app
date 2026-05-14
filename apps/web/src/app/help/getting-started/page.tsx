import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';

interface Step { title: string; body: React.ReactNode }

const STEPS: Step[] = [
  {
    title: '1. Look around',
    body: (
      <>
        Start at{' '}
        <Link href="/at-a-glance" className="text-yge-blue-700 hover:underline">/at-a-glance</Link>
        {' '}for a single-page command center. <Link href="/portfolio" className="text-yge-blue-700 hover:underline">/portfolio</Link>
        {' '}is the wider view. The <Link href="/sitemap" className="text-yge-blue-700 hover:underline">sitemap</Link>{' '}
        is the comprehensive index.
      </>
    ),
  },
  {
    title: '2. Bring in your data',
    body: (
      <>
        Visit the <Link href="/admin/csv-imports" className="text-yge-blue-700 hover:underline">CSV imports hub</Link>
        {' '}to bulk-load customers, vendors, materials, equipment, and cost codes. Every importer supports a dry-run preview before committing writes.
      </>
    ),
  },
  {
    title: '3. Record bid results',
    body: (
      <>
        Go to <Link href="/bid-results/new" className="text-yge-blue-700 hover:underline">/bid-results/new</Link>
        {' '}after each agency bid opening. Paste the multi-bidder tabulation directly into the form. Win-rate updates land automatically across every analytic view.
      </>
    ),
  },
  {
    title: '4. Cleanup',
    body: (
      <>
        Open <Link href="/admin/data-quality-hub" className="text-yge-blue-700 hover:underline">/admin/data-quality-hub</Link>
        {' '}weekly to chase down missing emails, phones, classifications, etc. The{' '}
        <Link href="/admin/data-quality-counts" className="text-yge-blue-700 hover:underline">counts page</Link>
        {' '}shows the total for every bucket in one table.
      </>
    ),
  },
  {
    title: '5. Track performance',
    body: (
      <>
        Use <Link href="/dashboard/morning-briefing" className="text-yge-blue-700 hover:underline">morning briefing</Link>,
        {' '}<Link href="/dashboard/this-month" className="text-yge-blue-700 hover:underline">this-month</Link>, and{' '}
        <Link href="/bid-results/top-competitors" className="text-yge-blue-700 hover:underline">top competitors</Link>
        {' '}to keep a pulse on bid pricing and pipeline movement.
      </>
    ),
  },
  {
    title: '6. When in doubt',
    body: (
      <>
        The <Link href="/help" className="text-yge-blue-700 hover:underline">help</Link> page has FAQs.
        The <Link href="/help/glossary" className="text-yge-blue-700 hover:underline">glossary</Link> defines every term.
        The <Link href="/feedback" className="text-yge-blue-700 hover:underline">feedback</Link> page mails Ryan directly.
      </>
    ),
  },
];

export default function GettingStartedPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Getting started" subtitle="Six steps to feel at home in the YGE app." />
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">{s.title}</div>
              <div className="mt-1 text-sm text-gray-700">{s.body}</div>
            </li>
          ))}
        </ol>
      </main>
    </AppShell>
  );
}
