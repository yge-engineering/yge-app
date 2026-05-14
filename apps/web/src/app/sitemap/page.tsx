import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';

interface Section { heading: string; links: Array<{ href: string; label: string }> }

const SECTIONS: Section[] = [
  {
    heading: 'Dashboard',
    links: [
      { href: '/', label: 'Home' },
      { href: '/dashboard/morning-briefing', label: 'Morning briefing' },
      { href: '/dashboard/this-month', label: 'This month' },
      { href: '/dashboard/last-7-days', label: 'Last 7 days' },
      { href: '/quick-tools', label: 'Quick tools index' },
    ],
  },
  {
    heading: 'Jobs',
    links: [
      { href: '/jobs', label: 'All jobs' },
      { href: '/jobs/active', label: 'Active jobs' },
      { href: '/jobs/awarded', label: 'Awarded jobs' },
      { href: '/jobs/lost', label: 'Lost jobs' },
      { href: '/jobs/recent', label: 'Recently updated' },
      { href: '/jobs/this-year', label: 'Created this year' },
      { href: '/jobs/this-month', label: 'Created this month' },
      { href: '/jobs/by-status', label: 'By status' },
      { href: '/jobs/by-month', label: 'By month' },
      { href: '/jobs/by-year', label: 'By year' },
      { href: '/jobs/by-rate-type', label: 'By rate type' },
      { href: '/jobs/by-owner-agency', label: 'By owner agency' },
      { href: '/jobs/by-location', label: 'By location' },
      { href: '/jobs/board', label: 'Pipeline board' },
      { href: '/jobs/awarded-revenue', label: 'Awarded revenue' },
      { href: '/jobs/budget-actual', label: 'Budget vs actual' },
      { href: '/jobs/missing-owner-agency', label: 'Missing owner agency' },
      { href: '/jobs/missing-job-number', label: 'Missing job number' },
    ],
  },
  {
    heading: 'Bid intel',
    links: [
      { href: '/bid-results', label: 'All bid results' },
      { href: '/bid-results/wins', label: 'Wins' },
      { href: '/bid-results/losses', label: 'Losses' },
      { href: '/bid-results/tbd', label: 'TBD' },
      { href: '/bid-results/apparent-lows', label: 'Apparent lows' },
      { href: '/bid-results/biggest-wins', label: 'Biggest wins' },
      { href: '/bid-results/closest-misses', label: 'Closest misses' },
      { href: '/bid-results/with-multiple-bidders', label: 'Competitive tabs' },
      { href: '/bid-results/top-competitors', label: 'Top competitors' },
      { href: '/bid-results/by-agency', label: 'By agency' },
      { href: '/bid-results/by-month', label: 'By month' },
      { href: '/bid-results/by-year', label: 'By year' },
      { href: '/bid-results/this-year', label: 'This year' },
      { href: '/bid-results/last-30-days', label: 'Last 30 days' },
      { href: '/bid-results/import', label: 'Import CSV' },
    ],
  },
  {
    heading: 'Contacts',
    links: [
      { href: '/customers', label: 'All customers' },
      { href: '/customers/recent', label: 'Recent customers' },
      { href: '/customers/this-year', label: 'Added this year' },
      { href: '/customers/this-month', label: 'Added this month' },
      { href: '/customers/on-hold', label: 'On-hold' },
      { href: '/customers/by-kind', label: 'By kind' },
      { href: '/customers/by-state', label: 'By state' },
      { href: '/customers/missing-email', label: 'Missing email' },
      { href: '/customers/newsletter', label: 'Newsletter composer' },
      { href: '/customers/email-list', label: 'Email list' },
      { href: '/vendors', label: 'All vendors' },
      { href: '/vendors/recent', label: 'Recent vendors' },
      { href: '/vendors/this-year', label: 'Added this year' },
      { href: '/vendors/this-month', label: 'Added this month' },
      { href: '/vendors/by-kind', label: 'By kind' },
      { href: '/vendors/by-state', label: 'By state' },
      { href: '/vendors/missing-email', label: 'Missing email' },
      { href: '/vendors/scorecard', label: 'Scorecard' },
      { href: '/vendors/coi-aging', label: 'COI aging' },
      { href: '/vendors/newsletter', label: 'Newsletter composer' },
    ],
  },
  {
    heading: 'People',
    links: [
      { href: '/employees/recent', label: 'Recent hires' },
      { href: '/employees/this-year', label: 'Hired this year' },
      { href: '/employees/by-status', label: 'By status' },
      { href: '/employees/by-classification', label: 'By classification' },
      { href: '/employees/missing-classification', label: 'Missing classification' },
    ],
  },
  {
    heading: 'Master data',
    links: [
      { href: '/materials', label: 'Materials' },
      { href: '/materials/recent', label: 'Recent materials' },
      { href: '/materials/by-category', label: 'By category' },
      { href: '/equipment-rates', label: 'Equipment rates' },
      { href: '/equipment-rates/recent', label: 'Recent equipment rates' },
      { href: '/equipment-rates/owned-vs-rental', label: 'Owned vs rental' },
      { href: '/labor-rates', label: 'Labor rates' },
      { href: '/labor-rates/recent', label: 'Recent labor rates' },
      { href: '/labor-rates/by-classification', label: 'By classification' },
      { href: '/cost-codes', label: 'Cost codes' },
      { href: '/cost-codes/recent', label: 'Recent cost codes' },
      { href: '/cost-codes/by-prefix', label: 'By prefix' },
    ],
  },
  {
    heading: 'Admin',
    links: [
      { href: '/admin', label: 'Admin home' },
      { href: '/admin/quick-links', label: 'Admin quick links' },
      { href: '/admin/data-summary', label: 'Data summary tiles' },
      { href: '/admin/data-status', label: 'Data status' },
      { href: '/admin/data-health', label: 'Data health' },
      { href: '/admin/data-quality', label: 'Data quality hub' },
      { href: '/admin/recent-activity', label: 'Recent activity' },
      { href: '/admin/api-endpoints', label: 'API endpoints' },
      { href: '/admin/csv-imports', label: 'CSV imports hub' },
      { href: '/admin/csv-exports', label: 'CSV exports hub' },
      { href: '/admin/bond-capacity', label: 'Bond capacity (preview)' },
      { href: '/admin/company-info', label: 'Company info' },
      { href: '/admin/onboarding', label: 'Onboarding' },
      { href: '/admin/portal-users', label: 'Portal users' },
      { href: '/admin/system-status', label: 'System status' },
      { href: '/admin/errors', label: 'Errors log' },
    ],
  },
  {
    heading: 'Help & meta',
    links: [
      { href: '/help', label: 'Help / FAQ' },
      { href: '/help/glossary', label: 'Glossary' },
      { href: '/about', label: 'About' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/keyboard-shortcuts', label: 'Keyboard shortcuts' },
      { href: '/feedback', label: 'Send feedback' },
      { href: '/sitemap', label: 'Site map (this page)' },
    ],
  },
];

export default function SitemapPage() {
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader title="Site map" subtitle="Every page in the YGE app, organized by area." />
        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.heading}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {s.links.map((l) => (
                  <li key={l.href} className="px-3 py-2">
                    <Link href={l.href} className="text-yge-blue-700 hover:underline">{l.label}</Link>
                    <span className="ml-2 font-mono text-[10px] text-gray-400">{l.href}</span>
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
