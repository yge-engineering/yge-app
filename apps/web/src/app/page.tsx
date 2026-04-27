// Home page — grouped link board.
//
// 50+ modules across 10 sections. The Dashboard + Plans-to-Estimate +
// Dispatch are the three most-used entry points; everything else is
// organized by what hat the user is wearing.

import Link from 'next/link';

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  title: string;
  blurb: string;
  links: NavLink[];
}

const GROUPS: NavGroup[] = [
  {
    title: 'Bidding',
    blurb: 'Plans-to-Estimate AI, drafts, priced bids, bid results.',
    links: [
      { href: '/plans-to-estimate', label: 'Plans-to-Estimate (AI)' },
      { href: '/drafts', label: 'Saved Drafts' },
      { href: '/estimates', label: 'Priced Estimates' },
      { href: '/bid-results', label: 'Bid Results' },
    ],
  },
  {
    title: 'Jobs',
    blurb: 'Award through closeout. Per-job binder + cost-by-code drilldown.',
    links: [
      { href: '/jobs', label: 'Jobs' },
      { href: '/job-profit', label: 'Job Profit' },
      { href: '/wip', label: 'WIP Report' },
      { href: '/change-orders', label: 'Change Orders' },
      { href: '/pcos', label: 'PCOs' },
      { href: '/rfis', label: 'RFIs' },
      { href: '/submittals', label: 'Submittals' },
      { href: '/punch-list', label: 'Punch List' },
    ],
  },
  {
    title: 'Field',
    blurb: 'Daily ops — dispatch, time, mileage, daily reports.',
    links: [
      { href: '/dispatch', label: 'Dispatch Board' },
      { href: '/daily-reports', label: 'Daily Reports' },
      { href: '/time-cards', label: 'Time Cards' },
      { href: '/mileage', label: 'Mileage Log' },
      { href: '/photos', label: 'Photo Log' },
    ],
  },
  {
    title: 'Safety',
    blurb: 'Cal/OSHA + CGP — toolbox talks, OSHA 300, SWPPP, certs, weather.',
    links: [
      { href: '/toolbox-talks', label: 'Toolbox Talks' },
      { href: '/incidents', label: 'OSHA 300 Log' },
      { href: '/swppp', label: 'SWPPP Inspections' },
      { href: '/weather', label: 'Weather Log' },
      { href: '/watchlist', label: 'Cert Watchlist' },
    ],
  },
  {
    title: 'People + Equipment',
    blurb: 'Crew, equipment, vendors + customers, sub prequal.',
    links: [
      { href: '/crew', label: 'Crew Roster' },
      { href: '/equipment', label: 'Equipment' },
      { href: '/tools', label: 'Power Tools' },
      { href: '/materials', label: 'Materials' },
      { href: '/customers', label: 'Customers' },
      { href: '/vendors', label: 'Vendors' },
      { href: '/subs', label: 'Sub Roster' },
    ],
  },
  {
    title: 'AR — Money in',
    blurb: 'Customer invoices, payments, lien waivers, retention.',
    links: [
      { href: '/ar-invoices', label: 'Customer Invoices' },
      { href: '/ar-payments', label: 'Customer Payments' },
      { href: '/lien-waivers', label: 'Lien Waivers' },
      { href: '/retention', label: 'Retention' },
    ],
  },
  {
    title: 'AP — Money out',
    blurb: 'Vendor bills, check register, employee reimbursements.',
    links: [
      { href: '/ap-invoices', label: 'AP Invoices' },
      { href: '/ap-payments', label: 'Check Register' },
      { href: '/expenses', label: 'Expenses' },
      { href: '/reimbursements', label: 'Reimbursements' },
    ],
  },
  {
    title: 'Books',
    blurb: 'GL — chart of accounts, JEs, financials, bank rec, close.',
    links: [
      { href: '/coa', label: 'Chart of Accounts' },
      { href: '/journal-entries', label: 'Journal Entries' },
      { href: '/trial-balance', label: 'Trial Balance' },
      { href: '/income-statement', label: 'P&L' },
      { href: '/balance-sheet', label: 'Balance Sheet' },
      { href: '/cash-forecast', label: 'Cash Forecast' },
      { href: '/aging', label: 'AR + AP Aging' },
      { href: '/bank-recs', label: 'Bank Reconciliation' },
      { href: '/close-checklist', label: 'Close Checklist' },
    ],
  },
  {
    title: 'Year-end',
    blurb: '1099 + W-2 + payroll prep for the CPA.',
    links: [
      { href: '/vendor-1099', label: '1099 Year-end' },
      { href: '/payroll-summary', label: 'Payroll Year-end' },
      { href: '/certified-payrolls', label: 'Certified Payroll' },
    ],
  },
  {
    title: 'Library + Setup',
    blurb: 'Static records and configuration.',
    links: [
      { href: '/dir-rates', label: 'DIR Rates' },
      { href: '/certificates', label: 'Certificates' },
      { href: '/documents', label: 'Documents' },
      { href: '/brand', label: 'Brand kit' },
    ],
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-4xl font-bold text-yge-blue-500">YGE App</h1>
        <p className="mt-2 text-sm uppercase tracking-wide text-gray-500">
          Young General Engineering, Inc.
        </p>
        <p className="mt-4 max-w-2xl text-gray-700">
          Estimating, job management, and bookkeeping for heavy civil work.
          Replaces Excel + QuickBooks Online with a single connected system.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded bg-yge-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
          >
            Open Dashboard
          </Link>
          <Link
            href="/dispatch"
            className="rounded bg-yge-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
          >
            Today's Dispatch
          </Link>
          <Link
            href="/plans-to-estimate"
            className="rounded border border-yge-blue-500 px-5 py-2 text-sm font-semibold text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Plans-to-Estimate (AI)
          </Link>
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <Group key={g.title} group={g} />
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-gray-400">
        Phase 1 MVP — under active development. See README.md and CLAUDE.md.
      </p>
    </main>
  );
}

function Group({ group }: { group: NavGroup }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-yge-blue-500">
        {group.title}
      </h2>
      <p className="mt-1 text-xs text-gray-500">{group.blurb}</p>
      <ul className="mt-3 space-y-1">
        {group.links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded px-2 py-1 text-sm text-gray-800 hover:bg-yge-blue-50 hover:text-yge-blue-700"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
