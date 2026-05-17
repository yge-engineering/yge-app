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
  { section: 'Customers', href: '/customers/by-area-code/print', label: 'By area code' },
  { section: 'Customers', href: '/customers/by-area-code-stats/print', label: 'Area-code stats' },
  { section: 'Customers', href: '/customers/by-domain/print', label: 'By email domain' },
  { section: 'Customers', href: '/customers/by-domain-stats/print', label: 'Domain stats' },
  { section: 'Customers', href: '/customers/by-state-and-domain/print', label: 'State x domain pivot' },
  { section: 'Vendors', href: '/vendors/by-kind/print', label: 'By kind' },
  { section: 'Vendors', href: '/vendors/by-state/print', label: 'By state' },
  { section: 'Vendors', href: '/vendors/by-area-code/print', label: 'By area code' },
  { section: 'Vendors', href: '/vendors/by-area-code-stats/print', label: 'Area-code stats' },
  { section: 'Vendors', href: '/vendors/by-domain/print', label: 'By email domain' },
  { section: 'Vendors', href: '/vendors/by-domain-stats/print', label: 'Domain stats' },
  { section: 'Jobs', href: '/jobs/by-status/print', label: 'By status' },
  { section: 'Jobs', href: '/jobs/by-owner-agency/print', label: 'By owner agency' },
  { section: 'Jobs', href: '/jobs/by-year/print', label: 'By year' },
  { section: 'Jobs', href: '/jobs/by-month/print', label: 'By month' },
  { section: 'Jobs', href: '/jobs/by-year-started-stats/print', label: 'Start-year stats' },
  { section: 'Jobs', href: '/jobs/by-status-and-owner-agency/print', label: 'Status x agency pivot' },
  { section: 'Employees', href: '/employees/by-classification/print', label: 'By classification' },
  { section: 'Employees', href: '/employees/by-rate-type/print', label: 'By rate type' },
  { section: 'Employees', href: '/employees/by-month-hired/print', label: 'By month hired' },
  { section: 'Employees', href: '/employees/by-year-hired/print', label: 'By year hired' },
  { section: 'Employees', href: '/employees/by-month-hired-stats/print', label: 'Hire-month stats' },
  { section: 'Employees', href: '/employees/by-classification-and-rate-type/print', label: 'Classification x rate-type pivot' },
];

export default function PrintRosterPage() {
  requirePermission('audit:view');
  const sections = Array.from(new Set(rows.map((r) => r.section)));
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Print roster" subtitle="Every print-friendly /print page in YGE, grouped by section." />
        <p className="mb-4 text-xs text-gray-600">
          All pages are <code className="rounded bg-gray-100 px-1">force-dynamic</code>: snapshot computed live in the browser at print time.
        </p>
        <div className="space-y-4">
          {sections.map((sec) => (
            <section key={sec} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-yge-blue-900">{sec}</h2>
              <ul className="space-y-1">
                {rows.filter((r) => r.section === sec).map((r) => (
                  <li key={r.href} className="text-xs">
                    <Link href={r.href} className="text-yge-blue-700 hover:underline">
                      {r.label} <span className="font-mono text-gray-500">{r.href}</span>
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
