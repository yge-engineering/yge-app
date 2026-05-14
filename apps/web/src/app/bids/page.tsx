// /bids — landing for everything bid-related.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

const LINKS = [
  { href: '/bids/calendar', title: 'Bid calendar', blurb: 'Upcoming bid deadlines by week.' },
  { href: '/bids/pipeline-forecast', title: 'Pipeline forecast', blurb: 'Open $ × agency win rate = expected $.' },
  { href: '/jobs/board', title: 'Jobs Kanban', blurb: 'Pursuit pipeline as a card board.' },
  { href: '/imported-estimates', title: 'Imported estimates', blurb: 'Every Excel-imported bid.' },
  { href: '/imported-estimates/search', title: 'Search bids', blurb: 'Full-text bid search.' },
  { href: '/imported-estimates/compare', title: 'Compare two bids', blurb: 'Side-by-side cost-code diff.' },
  { href: '/bid-results', title: 'Bid results — all', blurb: 'Every bid we have outcomes for.' },
  { href: '/bid-results/by-agency', title: 'Win rate by agency', blurb: 'Color-coded win rates.' },
  { href: '/bid-results/by-year', title: 'Bid history by year', blurb: 'YoY breakdown.' },
];

export default function BidsLandingPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Bids" subtitle="Pursue, price, win — everything bid-related in one place." />
        <ul className="grid gap-3 sm:grid-cols-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-yge-blue-300 hover:bg-yge-blue-50"
              >
                <div className="text-sm font-semibold text-yge-blue-900">{l.title}</div>
                <p className="text-xs text-gray-600">{l.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
