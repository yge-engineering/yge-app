import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const MISSING: Array<{ area: string; href: string; label: string }> = [
  { area: 'Customers', href: '/customers/missing-email', label: 'Missing email' },
  { area: 'Customers', href: '/customers/missing-phone', label: 'Missing phone' },
  { area: 'Customers', href: '/customers/missing-state', label: 'Missing state' },
  { area: 'Customers', href: '/customers/missing-billing-address', label: 'Missing billing address' },
  { area: 'Customers', href: '/customers/no-contact-info', label: 'No contact info' },
  { area: 'Vendors', href: '/vendors/missing-email', label: 'Missing email' },
  { area: 'Vendors', href: '/vendors/missing-phone', label: 'Missing phone' },
  { area: 'Vendors', href: '/vendors/missing-state', label: 'Missing state' },
  { area: 'Vendors', href: '/vendors/missing-billing-address', label: 'Missing billing address' },
  { area: 'Vendors', href: '/vendors/no-contact-info', label: 'No contact info' },
  { area: 'Jobs', href: '/jobs/missing-owner-agency', label: 'Missing owner agency' },
  { area: 'Jobs', href: '/jobs/missing-job-number', label: 'Missing job number' },
  { area: 'Jobs', href: '/jobs/missing-location', label: 'Missing location' },
  { area: 'Jobs', href: '/jobs/missing-status', label: 'Missing status' },
  { area: 'Jobs', href: '/jobs/missing-rate-type', label: 'Missing rate type' },
  { area: 'Employees', href: '/employees/missing-classification', label: 'Missing classification' },
  { area: 'Employees', href: '/employees/missing-hire-date', label: 'Missing hire date' },
];

export default function MissingPagesIndexPage() {
  requirePermission('audit:view');
  const groups: Record<string, Array<{ href: string; label: string }>> = {};
  for (const m of MISSING) {
    if (!groups[m.area]) groups[m.area] = [];
    groups[m.area]!.push({ href: m.href, label: m.label });
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Missing-X pages index" subtitle={`${MISSING.length} data-quality cleanup views indexed by area.`} />
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groups).map(([area, list]) => (
            <section key={area}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {list.map((it) => (
                  <li key={it.href} className="px-3 py-2">
                    <Link href={it.href} className="text-red-700 hover:underline">{it.label}</Link>
                    <span className="ml-2 font-mono text-[10px] text-gray-400">{it.href}</span>
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
