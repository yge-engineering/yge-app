import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const URLS: string[] = [
  '/customers/with-email',
  '/customers/with-phone',
  '/customers/with-state',
  '/customers/with-billing-address',
  '/vendors/with-email',
  '/vendors/with-phone',
  '/vendors/with-state',
  '/vendors/with-billing-address',
  '/jobs/with-owner-agency',
  '/jobs/with-job-number',
  '/jobs/with-location',
  '/jobs/with-status',
  '/jobs/with-rate-type',
  '/employees/with-classification',
  '/employees/with-hire-date',
];

export default function AllWithPagesPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="All with-X pages" subtitle={`${sorted.length} positive coverage views, alphabetical.`} />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
          {sorted.map((href) => (
            <li key={href} className="px-3 py-1.5">
              <Link href={href} className="font-mono text-xs text-green-700 hover:underline">{href}</Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
