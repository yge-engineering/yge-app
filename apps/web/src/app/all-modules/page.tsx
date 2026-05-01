// /all-modules — full module directory.
//
// Plain English: the "everything in the app, on one page" view. The
// sidebar covers the daily flow; this is the cheat-sheet for finding
// something you don't see in the sidebar.

import Link from 'next/link';

import { AppShell, Card, PageHeader } from '../../components';

interface ModuleLink {
  href: string;
  label: string;
  blurb: string;
}

interface ModuleGroup {
  title: string;
  blurb: string;
  links: ModuleLink[];
}

const GROUPS: ModuleGroup[] = [
  {
    title: 'Bidding',
    blurb: 'From plan set to priced bid envelope.',
    links: [
      { href: '/plans-to-estimate', label: 'Plans-to-Estimate (AI)', blurb: 'Upload a plan PDF, AI drafts quantities, you approve' },
      { href: '/drafts', label: 'Drafts', blurb: 'Saved estimate drafts in progress' },
      { href: '/estimates', label: 'Estimates', blurb: 'Priced estimates ready to bid' },
      { href: '/bid-results', label: 'Bid results', blurb: 'Agency tabulations, win-rate tracking' },
      { href: '/subs', label: 'Subcontractor list (PCC §4104)', blurb: 'Required listing for CA public works' },
    ],
  },
  {
    title: 'Daily field',
    blurb: 'What the foremen and crews touch every morning.',
    links: [
      { href: '/dispatch', label: 'Dispatch board', blurb: 'Daily crew + equipment assignments' },
      { href: '/daily-reports', label: 'Daily reports', blurb: 'End-of-day foreman submissions' },
      { href: '/time-cards', label: 'Time cards', blurb: 'Weekly per-employee hours' },
      { href: '/crew', label: 'Active roster', blurb: 'Foreman-grouped crew view' },
      { href: '/photos', label: 'Field photos', blurb: 'Cross-job photo log' },
    ],
  },
  {
    title: 'Project execution',
    blurb: 'Living job paperwork — RFIs, submittals, COs, punch.',
    links: [
      { href: '/jobs', label: 'Jobs', blurb: 'Active + pursuit pipeline' },
      { href: '/rfis', label: 'RFIs', blurb: 'Requests for information' },
      { href: '/submittals', label: 'Submittals', blurb: 'Shop drawings, product data, samples' },
      { href: '/change-orders', label: 'Change orders', blurb: 'Executed contract modifications' },
      { href: '/pcos', label: 'PCOs', blurb: 'Pending change order exposure' },
      { href: '/punch-lists', label: 'Punch lists', blurb: 'Closeout walkthrough items' },
    ],
  },
  {
    title: 'Money in / money out',
    blurb: 'Everything that touches the bank account.',
    links: [
      { href: '/ar-invoices', label: 'AR invoices', blurb: 'Billings sent to customers' },
      { href: '/ar-payments', label: 'AR payments', blurb: 'Money received' },
      { href: '/ap-invoices', label: 'AP invoices', blurb: 'Bills from vendors' },
      { href: '/ap-payments', label: 'AP payments', blurb: 'Money paid out' },
      { href: '/aging', label: 'Aging', blurb: '0-30 / 31-60 / 61-90 / 91+ buckets' },
      { href: '/retention', label: 'Retention', blurb: 'PCC §7107 holds + release tracking' },
      { href: '/reimbursements', label: 'Reimbursements', blurb: 'Out-of-pocket expense reimbursement queue' },
      { href: '/cash-forecast', label: 'Cash forecast', blurb: 'Forward cash position' },
      { href: '/bank-recs', label: 'Bank recs', blurb: 'Statement reconciliation' },
      { href: '/prompt-pay', label: 'Prompt-pay claim', blurb: 'CA §7107(f) interest auto-calc' },
    ],
  },
  {
    title: 'Books',
    blurb: 'GL, statements, close.',
    links: [
      { href: '/coa', label: 'Chart of accounts', blurb: 'GL accounts' },
      { href: '/journal-entries', label: 'Journal entries', blurb: 'Manual + auto-posted JEs' },
      { href: '/trial-balance', label: 'Trial balance', blurb: 'Cumulative debit/credit balance' },
      { href: '/income-statement', label: 'Income statement', blurb: 'Revenue / cost / overhead / net' },
      { href: '/balance-sheet', label: 'Balance sheet', blurb: 'Assets / liabilities / equity' },
      { href: '/wip', label: 'WIP schedule', blurb: 'Work in progress accounting' },
      { href: '/job-profit', label: 'Job profit', blurb: 'Per-job revenue minus cost minus overhead' },
      { href: '/close-checklist', label: 'Close checklist', blurb: 'Month-end close steps' },
    ],
  },
  {
    title: 'Equipment + assets',
    blurb: 'Heavy iron, tools, materials.',
    links: [
      { href: '/equipment', label: 'Equipment', blurb: 'Heavy iron + vehicles' },
      { href: '/tools', label: 'Tools', blurb: 'Small tools & expendables' },
      { href: '/materials', label: 'Materials', blurb: 'Bulk material inventory' },
      { href: '/crew-utilization', label: 'Crew utilization', blurb: 'Hours-per-employee-per-week' },
    ],
  },
  {
    title: 'Compliance',
    blurb: 'CA labor law, OSHA, lien waivers, certified payrolls.',
    links: [
      { href: '/lien-waivers', label: 'Lien waivers', blurb: 'CC §8132/§8134/§8136/§8138' },
      { href: '/certified-payrolls', label: 'Certified payrolls', blurb: 'Public works CPRs' },
      { href: '/dir-rates', label: 'DIR rates', blurb: 'CA prevailing wage tables' },
      { href: '/toolbox-talks', label: 'Toolbox talks', blurb: 'T8 §1509 weekly tailgate meetings' },
      { href: '/incidents', label: 'Incidents', blurb: 'OSHA 300 / 300A / 301' },
      { href: '/weather', label: 'Weather log', blurb: 'Per-day weather + §3395 heat' },
      { href: '/swppp', label: 'SWPPP', blurb: 'Stormwater BMP inspections' },
      { href: '/certificates', label: 'Certificates', blurb: 'Employee certs + expiry watch' },
      { href: '/vendor-1099', label: '1099 prep', blurb: 'Year-end vendor 1099 totals' },
    ],
  },
  {
    title: 'Records',
    blurb: 'Master data + people.',
    links: [
      { href: '/customers', label: 'Customers', blurb: 'Agencies + private clients' },
      { href: '/vendors', label: 'Vendors', blurb: 'Subs + suppliers' },
      { href: '/employees', label: 'Employees', blurb: 'Crew roster' },
      { href: '/documents', label: 'Documents', blurb: 'Files attached to jobs / vendors' },
      { href: '/brand', label: 'Brand kit', blurb: 'Logo, letterhead, colors' },
    ],
  },
  {
    title: 'Other',
    blurb: 'Misc.',
    links: [
      { href: '/mileage', label: 'Mileage log', blurb: 'IRS reimbursable trips' },
      { href: '/expenses', label: 'Employee expenses', blurb: 'Field receipts' },
      { href: '/payroll-summary', label: 'Payroll summary', blurb: 'Per-week per-employee totals' },
      { href: '/watchlist', label: 'Watchlist', blurb: 'Compliance flags worth eyeballing' },
    ],
  },
];

export default function AllModulesPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="All modules"
          subtitle="Everything in the app on one page. Use the sidebar for the daily stuff; come here when you can't remember where something lives."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <Card key={g.title}>
              <h2 className="text-sm font-semibold text-gray-900">{g.title}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{g.blurb}</p>
              <ul className="mt-3 space-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="block rounded px-2 py-1.5 -mx-2 hover:bg-gray-50"
                    >
                      <div className="text-sm font-medium text-blue-700">{l.label}</div>
                      <div className="text-xs text-gray-500">{l.blurb}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
