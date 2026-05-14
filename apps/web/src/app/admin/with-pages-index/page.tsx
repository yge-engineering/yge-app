import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const WITH: Array<{ area: string; href: string; label: string }> = [
  { area: 'Customers', href: '/customers/with-email', label: 'With email' },
  { area: 'Customers', href: '/customers/with-phone', label: 'With phone' },
  { area: 'Customers', href: '/customers/with-state', label: 'With state' },
  { area: 'Customers', href: '/customers/with-billing-address', label: 'With billing address' },
  { area: 'Vendors', href: '/vendors/with-email', label: 'With email' },
  { area: 'Vendors', href: '/vendors/with-phone', label: 'With phone' },
  { area: 'Vendors', href: '/vendors/with-state', label: 'With state' },
  { area: 'Vendors', href: '/vendors/with-billing-address', label: 'With billing address' },
  { area: 'Jobs', href: '/jobs/with-owner-agency', label: 'With owner agency' },
  { area: 'Jobs', href: '/jobs/with-job-number', label: 'With job number' },
  { area: 'Jobs', href: '/jobs/with-location', label: 'With location' },
  { area: 'Jobs', href: '/jobs/with-status', label: 'With status' },
  { area: 'Jobs', href: '/jobs/with-rate-type', label: 'With rate type' },
  { area: 'Employees', href: '/employees/with-classification', label: 'With classification' },
  { area: 'Employees', href: '/employees/with-hire-date', label: 'With hire date' },
];

export default function WithPagesIndexPage() {
  requirePermission('audit:view');
  const groups: Record<string, Array<{ href: string; label: string }>> = {};
  for (const w of WITH) {
    if (!groups[w.area]) groups[w.area] = [];
    groups[w.area]!.push({ href: w.href, label: w.label });
  }
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="With-X pages index" subtitle={`${WITH.length} positive coverage views indexed by area.`} />
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groups).map(([area, list]) => (
            <section key={area}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{area}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {list.map((it) => (
                  <li key={it.href} className="px-3 py-2">
                    <Link href={it.href} className="text-green-700 hover:underline">{it.label}</Link>
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
