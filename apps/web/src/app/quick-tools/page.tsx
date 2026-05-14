import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';

interface ToolLink { href: string; title: string; description: string; group: string }

const TOOLS: ToolLink[] = [
  // Estimating
  { href: '/jobs/active', title: 'Active jobs', description: 'AWARDED + BID_SUBMITTED rollup.', group: 'Estimating' },
  { href: '/jobs/board', title: 'Pipeline board', description: 'Kanban-style job pipeline.', group: 'Estimating' },
  { href: '/jobs/by-status', title: 'Jobs by status', description: 'Counts of jobs per pipeline status.', group: 'Estimating' },
  { href: '/jobs/by-rate-type', title: 'Jobs by rate type', description: 'PW vs Private project split.', group: 'Estimating' },
  { href: '/jobs/by-year', title: 'Jobs by year', description: 'YoY job creation + win/lose split.', group: 'Estimating' },
  { href: '/jobs/by-month', title: 'Jobs by month', description: 'Month-over-month new jobs.', group: 'Estimating' },
  // Bid intel
  { href: '/bid-results', title: 'Bid history', description: 'Every recorded agency bid result.', group: 'Bid intel' },
  { href: '/bid-results/by-agency', title: 'Bid results by agency', description: 'Win-rate per owner agency.', group: 'Bid intel' },
  { href: '/bid-results/by-year', title: 'Bid results by year', description: 'Annual wins/losses + won $.', group: 'Bid intel' },
  { href: '/bid-results/by-month', title: 'Bid results by month', description: 'Month-over-month win rate.', group: 'Bid intel' },
  // Customer + vendor
  { href: '/customers', title: 'Customers', description: 'Customer master list.', group: 'Contacts' },
  { href: '/customers/by-kind', title: 'Customers by kind', description: 'Customer master grouped by kind.', group: 'Contacts' },
  { href: '/customers/by-state', title: 'Customers by state', description: 'Geographic spread of customers.', group: 'Contacts' },
  { href: '/customers/newsletter', title: 'Customer newsletter', description: 'Bulk outreach composer.', group: 'Contacts' },
  { href: '/vendors', title: 'Vendors', description: 'Vendor master list.', group: 'Contacts' },
  { href: '/vendors/by-kind', title: 'Vendors by kind', description: 'Vendor master grouped by kind.', group: 'Contacts' },
  { href: '/vendors/by-state', title: 'Vendors by state', description: 'Geographic spread of vendors.', group: 'Contacts' },
  { href: '/vendors/newsletter', title: 'Vendor newsletter', description: 'Bulk vendor outreach composer.', group: 'Contacts' },
  { href: '/vendors/scorecard', title: 'Vendor scorecard', description: 'Sub/supplier performance dashboard.', group: 'Contacts' },
  { href: '/vendors/coi-aging', title: 'COI aging', description: 'Expired or expiring insurance.', group: 'Contacts' },
  // Admin
  { href: '/admin', title: 'Admin home', description: 'Top-level admin landing page.', group: 'Admin' },
  { href: '/admin/quick-links', title: 'Admin quick links', description: 'Flat directory of every admin tool.', group: 'Admin' },
  { href: '/admin/data-summary', title: 'Data summary tiles', description: 'Visual scan of record counts.', group: 'Admin' },
  { href: '/admin/csv-imports', title: 'CSV imports hub', description: 'Bulk import master data.', group: 'Admin' },
  { href: '/admin/csv-exports', title: 'CSV exports hub', description: 'Download master data CSVs.', group: 'Admin' },
];

export default function QuickToolsPage() {
  requirePermission('estimates:view');
  const groups: Record<string, ToolLink[]> = {};
  for (const t of TOOLS) {
    if (!groups[t.group]) groups[t.group] = [];
    groups[t.group]!.push(t);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="Quick tools"
          subtitle="Every analytic + utility page across the app in one bookmarkable list."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groups).map(([g, links]) => (
            <section key={g}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{g}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
                {links.map((t) => (
                  <li key={t.href} className="px-3 py-2">
                    <Link href={t.href} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                      {t.title}
                    </Link>
                    <div className="text-xs text-gray-600">{t.description}</div>
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
