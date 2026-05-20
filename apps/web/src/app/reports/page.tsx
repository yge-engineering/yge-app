import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

interface Report { area: string; name: string; href: string }

const REPORTS: Report[] = [
  { area: 'Financials', name: 'Income statement (P&L)', href: '/income-statement' },
  { area: 'Financials', name: 'Balance sheet', href: '/balance-sheet' },
  { area: 'Financials', name: 'Cash flow', href: '/cash-flow' },
  { area: 'Financials', name: 'Trial balance', href: '/trial-balance' },
  { area: 'Financials', name: 'AR / AP aging', href: '/aging' },
  { area: 'Financials', name: 'WIP (work in progress)', href: '/wip' },
  { area: 'Financials', name: 'Account ledger', href: '/journal-entries/by-account' },
  { area: 'Bid intel', name: 'By year', href: '/bid-results/by-year' },
  { area: 'Bid intel', name: 'By quarter', href: '/bid-results/by-quarter' },
  { area: 'Bid intel', name: 'By month', href: '/bid-results/by-month' },
  { area: 'Bid intel', name: 'By agency', href: '/bid-results/by-agency' },
  { area: 'Bid intel', name: 'By amount bucket', href: '/bid-results/by-amount-bucket' },
  { area: 'Bid intel', name: 'By rank', href: '/bid-results/by-rank' },
  { area: 'Bid intel', name: 'Top competitors', href: '/bid-results/top-competitors' },
  { area: 'Bid intel', name: 'Biggest wins', href: '/bid-results/biggest-wins' },
  { area: 'Bid intel', name: 'Closest misses', href: '/bid-results/closest-misses' },
  { area: 'Bid intel', name: 'Apparent lows', href: '/bid-results/apparent-lows' },

  { area: 'Jobs', name: 'By status', href: '/jobs/by-status' },
  { area: 'Jobs', name: 'By rate type', href: '/jobs/by-rate-type' },
  { area: 'Jobs', name: 'By owner agency', href: '/jobs/by-owner-agency' },
  { area: 'Jobs', name: 'By year', href: '/jobs/by-year' },
  { area: 'Jobs', name: 'By quarter', href: '/jobs/by-quarter' },
  { area: 'Jobs', name: 'By month', href: '/jobs/by-month' },
  { area: 'Jobs', name: 'By location', href: '/jobs/by-location' },
  { area: 'Jobs', name: 'Awarded revenue', href: '/jobs/awarded-revenue' },
  { area: 'Jobs', name: 'Budget vs actual', href: '/jobs/budget-actual' },
  { area: 'Jobs', name: 'Closed by year', href: '/jobs/closed-by-year' },

  { area: 'Contacts', name: 'Customers by kind', href: '/customers/by-kind' },
  { area: 'Contacts', name: 'Customers by state', href: '/customers/by-state' },
  { area: 'Contacts', name: 'Customers by city', href: '/customers/by-city' },
  { area: 'Contacts', name: 'Customers by zip', href: '/customers/by-zip' },
  { area: 'Contacts', name: 'Customers by payment terms', href: '/customers/by-payment-terms' },
  { area: 'Contacts', name: 'Vendors by kind', href: '/vendors/by-kind' },
  { area: 'Contacts', name: 'Vendors by state', href: '/vendors/by-state' },
  { area: 'Contacts', name: 'Vendors by city', href: '/vendors/by-city' },
  { area: 'Contacts', name: 'Vendors by zip', href: '/vendors/by-zip' },
  { area: 'Contacts', name: 'Vendor scorecard', href: '/vendors/scorecard' },
  { area: 'Contacts', name: 'COI aging', href: '/vendors/coi-aging' },

  { area: 'People', name: 'Employees by status', href: '/employees/by-status' },
  { area: 'People', name: 'Employees by classification', href: '/employees/by-classification' },
  { area: 'People', name: 'Employees by tenure', href: '/employees/by-tenure' },

  { area: 'Master data', name: 'Materials by category', href: '/materials/by-category' },
  { area: 'Master data', name: 'Equipment owned vs rental', href: '/equipment-rates/owned-vs-rental' },
  { area: 'Master data', name: 'Labor rates by classification', href: '/labor-rates/by-classification' },
  { area: 'Master data', name: 'Labor rates by rate type', href: '/labor-rates/by-rate-type' },
  { area: 'Master data', name: 'Cost codes by prefix', href: '/cost-codes/by-prefix' },
  { area: 'Master data', name: 'Estimates by rate type', href: '/imported-estimates/by-rate-type' },
];

export default function ReportsPage() {
  requirePermission('financials:view');
  const groups: Record<string, Report[]> = {};
  for (const r of REPORTS) {
    if (!groups[r.area]) groups[r.area] = [];
    groups[r.area]!.push(r);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Reports" subtitle="Every analytic / grouping view across the app, organized by area." />
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groups).map(([area, list]) => (
            <section key={area}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {list.map((r) => (
                  <li key={r.href} className="px-3 py-2">
                    <Link href={r.href} className="text-yge-blue-700 hover:underline">{r.name}</Link>
                    <span className="ml-2 font-mono text-[10px] text-gray-400">{r.href}</span>
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
