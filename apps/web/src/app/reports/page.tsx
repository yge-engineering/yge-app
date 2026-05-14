// /reports — unified index of every analytics page in the app.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

interface ReportCard {
  href: string;
  title: string;
  blurb: string;
}

interface Group {
  name: string;
  cards: ReportCard[];
}

const GROUPS: Group[] = [
  {
    name: 'Pipeline & pursuit',
    cards: [
      {
        href: '/bids/calendar',
        title: 'Bid calendar',
        blurb: 'Every pursuing job with a bid due date, grouped by week. Overdue bids float to the top.',
      },
      {
        href: '/jobs/board',
        title: 'Jobs Kanban',
        blurb: 'Pursuit pipeline as a card board (PROSPECT → PURSUING → SUBMITTED → AWARDED).',
      },
      {
        href: '/imported-estimates',
        title: 'Imported estimates',
        blurb: 'Every estimate imported from Excel, with audit-warning chips and bid-status badges.',
      },
      {
        href: '/imported-estimates/compare',
        title: 'Compare two bids',
        blurb: 'Side-by-side cost-code diff between any two imported estimates.',
      },
    ],
  },
  {
    name: 'Cost analysis',
    cards: [
      {
        href: '/cost-codes',
        title: 'Cost code master + top 10',
        blurb: 'Every cost code, with a top-10 by bid$ spend across all estimates.',
      },
      {
        href: '/equipment-rates/usage',
        title: 'Equipment usage',
        blurb: 'Bid vs Actual hours and $ per piece of equipment across every job.',
      },
      {
        href: '/employees/utilization',
        title: 'Labor utilization',
        blurb: 'Hours logged per employee per week, from daily report LAB-* lines.',
      },
    ],
  },
  {
    name: 'Bids & wins',
    cards: [
      {
        href: '/bid-results',
        title: 'Bid results — all',
        blurb: 'Every bid we have outcome data on, plus lifetime win rate.',
      },
      {
        href: '/bid-results/by-agency',
        title: 'Win rate by agency',
        blurb: 'How often we win at each owner agency, color-coded.',
      },
    ],
  },
  {
    name: 'People',
    cards: [
      {
        href: '/customers',
        title: 'Customers',
        blurb: 'Customer master with jobsCount, with rollup detail on click.',
      },
      {
        href: '/vendors/scorecard',
        title: 'Subcontractor scorecard',
        blurb: 'Per-sub paid total, open balance, avg days-to-pay, jobs delivered.',
      },
      {
        href: '/employees',
        title: 'Employees',
        blurb: 'Staff master list.',
      },
    ],
  },
];

export default function ReportsIndexPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Reports & analytics"
          subtitle="All the pipeline, cost, bid, and people rollups in one place."
        />

        <div className="space-y-8">
          {GROUPS.map((g) => (
            <section key={g.name}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {g.name}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {g.cards.map((c) => (
                  <li key={c.href}>
                    <Link
                      href={c.href}
                      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-yge-blue-300 hover:bg-yge-blue-50"
                    >
                      <div className="text-sm font-semibold text-yge-blue-900">
                        {c.title}
                      </div>
                      <p className="mt-1 text-xs text-gray-600">{c.blurb}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
