import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const URLS: string[] = [
  '/customers/missing-email',
  '/customers/missing-phone',
  '/customers/missing-state',
  '/customers/missing-billing-address',
  '/customers/no-contact-info',
  '/vendors/missing-email',
  '/vendors/missing-phone',
  '/vendors/missing-state',
  '/vendors/missing-billing-address',
  '/vendors/no-contact-info',
  '/jobs/missing-owner-agency',
  '/jobs/missing-job-number',
  '/jobs/missing-location',
  '/jobs/missing-status',
  '/jobs/missing-rate-type',
  '/employees/missing-classification',
  '/employees/missing-hire-date',
];

export default function AllMissingPagesPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="All missing-X pages" subtitle={`${sorted.length} data-quality cleanup views, alphabetical.`} />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
          {sorted.map((href) => (
            <li key={href} className="px-3 py-1.5">
              <Link href={href} className="font-mono text-xs text-red-700 hover:underline">{href}</Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
