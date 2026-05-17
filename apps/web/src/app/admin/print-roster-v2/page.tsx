import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Row {
  href: string;
  label: string;
  section: string;
}

const rows: Row[] = [
  { section: 'Dashboards', href: '/at-a-glance-totals/print', label: 'Master-data totals' },
  { section: 'Dashboards', href: '/at-a-glance-missing/print', label: 'Missing-field totals' },
  { section: 'Dashboards', href: '/at-a-glance-grade/print', label: 'A-F grade' },
  { section: 'Dashboards', href: '/at-a-glance-completeness/print', label: 'Per-entity completeness' },
  { section: 'Customers', href: '/customers/by-state/print', label: 'By state' },
  { section: 'Customers', href: '/customers/by-state-detail/print', label: 'By state (detail)' },
  { section: 'Customers', href: '/customers/by-area-code/print', label: 'By area code' },
  { section: 'Customers', href: '/customers/by-area-code-detail/print', label: 'By area code (detail)' },
  { section: 'Customers', href: '/customers/by-area-code-stats/print', label: 'Area-code stats' },
  { section: 'Customers', href: '/customers/by-domain/print', label: 'By email domain' },
  { section: 'Customers', href: '/customers/by-domain-detail/print', label: 'By domain (detail)' },
  { section: 'Customers', href: '/customers/by-domain-stats/print', label: 'Domain stats' },
  { section: 'Customers', href: '/customers/by-state-and-domain/print', label: 'State x domain pivot' },
  { section: 'Customers', href: '/customers/by-state-and-domain-detail/print', label: 'State x domain (detail)' },
  { section: 'Vendors', href: '/vendors/by-kind/print', label: 'By kind' },
  { section: 'Vendors', href: '/vendors/by-kind-detail/print', label: 'By kind (detail)' },
  { section: 'Vendors', href: '/vendors/by-state/print', label: 'By state' },
  { section: 'Vendors', href: '/vendors/by-state-detail/print', label: 'By state (detail)' },
  { section: 'Vendors', href: '/vendors/by-area-code/print', label: 'By area code' },
  { section: 'Vendors', href: '/vendors/by-area-code-detail/print', label: 'By area code (detail)' },
  { section: 'Vendors', href: '/vendors/by-area-code-stats/print', label: 'Area-code stats' },
  { section: 'Vendors', href: '/vendors/by-domain/print', label: 'By email domain' },
  { section: 'Vendors', href: '/vendors/by-domain-detail/print', label: 'By domain (detail)' },
  { section: 'Vendors', href: '/vendors/by-domain-stats/print', label: 'Domain stats' },
  { section: 'Jobs', href: '/jobs/by-status/print', label: 'By status' },
  { section: 'Jobs', href: '/jobs/by-status-detail/print', label: 'By status (detail)' },
  { section: 'Jobs', href: '/jobs/by-owner-agency/print', label: 'By owner agency' },
  { section: 'Jobs', href: '/jobs/by-year/print', label: 'By year' },
  { section: 'Jobs', href: '/jobs/by-year-detail/print', label: 'By year (detail)' },
  { section: 'Jobs', href: '/jobs/by-month/print', label: 'By month' },
  { section: 'Jobs', href: '/jobs/by-month-detail/print', label: 'By month (detail)' },
  { section: 'Jobs', href: '/jobs/by-month-started-detail/print', label: 'By month started (detail)' },
  { section: 'Jobs', href: '/jobs/by-year-started-detail/print', label: 'By year started (detail)' },
  { section: 'Jobs', href: '/jobs/by-year-started-stats/print', label: 'Start-year stats' },
  { section: 'Jobs', href: '/jobs/by-month-started-stats/print', label: 'Start-month stats' },
  { section: 'Jobs', href: '/jobs/by-status-and-owner-agency/print', label: 'Status x agency pivot' },
  { section: 'Jobs', href: '/jobs/by-status-and-owner-agency-detail/print', label: 'Status x agency (detail)' },
  { section: 'Jobs', href: '/jobs/awarded-by-year/print', label: 'Awarded by year' },
  { section: 'Jobs', href: '/jobs/awarded-by-agency/print', label: 'Awarded by agency' },
  { section: 'Jobs', href: '/jobs/active-by-year/print', label: 'Active by year' },
  { section: 'Jobs', href: '/jobs/active-by-agency/print', label: 'Active by agency' },
  { section: 'Jobs', href: '/jobs/lost-by-year/print', label: 'Lost by year' },
  { section: 'Employees', href: '/employees/by-classification/print', label: 'By classification' },
  { section: 'Employees', href: '/employees/by-classification-detail/print', label: 'By classification (detail)' },
  { section: 'Employees', href: '/employees/by-rate-type/print', label: 'By rate type' },
  { section: 'Employees', href: '/employees/by-month-hired/print', label: 'By month hired' },
  { section: 'Employees', href: '/employees/by-month-hired-detail/print', label: 'By month hired (detail)' },
  { section: 'Employees', href: '/employees/by-month-hired-stats/print', label: 'Hire-month stats' },
  { section: 'Employees', href: '/employees/by-year-hired/print', label: 'By year hired' },
  { section: 'Employees', href: '/employees/by-year-hired-detail/print', label: 'By year hired (detail)' },
  { section: 'Employees', href: '/employees/by-year-hired-stats/print', label: 'Hire-year stats' },
  { section: 'Employees', href: '/employees/by-classification-and-rate-type/print', label: 'Classification x rate-type pivot' },
  { section: 'Employees', href: '/employees/by-classification-and-rate-type-detail/print', label: 'Classification x rate-type (detail)' },
];

export default function PrintRosterV2Page() {
  requirePermission('audit:view');
  const sections = Array.from(new Set(rows.map((r) => r.section)));
  const subtitle = `Refreshed list — now ${rows.length} print-friendly pages.`;
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Print roster (v2)" subtitle={subtitle} />
        <p className="mb-4 text-xs text-gray-600">
          All routes are <code className="rounded bg-gray-100 px-1">force-dynamic</code>: live snapshot at print time.
          Earlier version at <Link href="/admin/print-roster" className="text-yge-blue-700 hover:underline">/admin/print-roster</Link>.
        </p>
        <div className="space-y-4">
          {sections.map((sec) => {
            const secRows = rows.filter((r) => r.section === sec);
            return (
              <section key={sec} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-yge-blue-900">{sec}</h2>
                  <span className="text-[11px] text-gray-500">{secRows.length} pages</span>
                </div>
                <ul className="space-y-1">
                  {secRows.map((r) => (
                    <li key={r.href} className="text-xs">
                      <Link href={r.href} className="text-yge-blue-700 hover:underline">
                        {r.label} <span className="font-mono text-gray-500">{r.href}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </AppShell>
  );
}
