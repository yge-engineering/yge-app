import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const CARDS = [
  { href: '/daily-reports/imported', title: 'All imported reports', blurb: 'List view of all Excel-imported daily reports.' },
  { href: '/daily-reports/range', title: 'Date range query', blurb: 'Filter reports by date + optional job.' },
  { href: '/daily-reports/new', title: 'New foreman report', blurb: 'Create a multi-line foreman daily report (rich form).' },
];

export default function DailyReportsQuickActionsPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Daily reports" subtitle="Quick links to common report views and entries." />
        <ul className="grid gap-3 sm:grid-cols-3">
          {CARDS.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-yge-blue-300 hover:bg-yge-blue-50"
              >
                <div className="text-sm font-semibold text-yge-blue-900">{c.title}</div>
                <p className="text-xs text-gray-600">{c.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
