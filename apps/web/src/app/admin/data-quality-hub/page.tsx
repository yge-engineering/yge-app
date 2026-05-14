import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Section { title: string; items: Array<{ href: string; label: string }> }

const SECTIONS: Section[] = [
  {
    title: 'Customers',
    items: [
      { href: '/customers/missing-email', label: 'Missing email' },
      { href: '/customers/missing-phone', label: 'Missing phone' },
      { href: '/customers/missing-state', label: 'Missing state' },
      { href: '/customers/on-hold', label: 'On-hold accounts' },
    ],
  },
  {
    title: 'Vendors',
    items: [
      { href: '/vendors/missing-email', label: 'Missing email' },
      { href: '/vendors/missing-phone', label: 'Missing phone' },
      { href: '/vendors/missing-state', label: 'Missing state' },
      { href: '/vendors/coi-aging', label: 'COI aging' },
    ],
  },
  {
    title: 'Jobs',
    items: [
      { href: '/jobs/missing-owner-agency', label: 'Missing owner agency' },
      { href: '/jobs/missing-job-number', label: 'Missing job number' },
      { href: '/jobs/missing-location', label: 'Missing location' },
      { href: '/jobs/missing-status', label: 'Missing status' },
    ],
  },
  {
    title: 'Employees',
    items: [
      { href: '/employees/missing-classification', label: 'Missing classification' },
      { href: '/employees/missing-hire-date', label: 'Missing hire date' },
    ],
  },
  {
    title: 'Audit',
    items: [
      { href: '/admin/data-status', label: 'Record counts per entity' },
      { href: '/admin/data-health', label: 'Sanity-check rule failures' },
    ],
  },
];

export default function DataQualityHubPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Data quality hub" subtitle="Every missing-field cleanup view, organized by entity." />
        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{s.title}</h2>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                {s.items.map((it) => (
                  <li key={it.href} className="px-3 py-2">
                    <Link href={it.href} className="text-yge-blue-700 hover:underline">{it.label}</Link>
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
