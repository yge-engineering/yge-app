import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

const URLS: string[] = [
  '/jobs/recent',
  '/customers/recent',
  '/vendors/recent',
  '/employees/recent',
  '/materials/recent',
  '/equipment-rates/recent',
  '/labor-rates/recent',
  '/cost-codes/recent',
  '/imported-estimates/recent',
  '/daily-reports/recent',
];

export default function AllRecentPagesPage() {
  requirePermission('audit:view');
  const sorted = [...new Set(URLS)].sort();
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="All recent-X pages" subtitle={`${sorted.length} "last 25" lists, alphabetical.`} />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
          {sorted.map((href) => (
            <li key={href} className="px-3 py-1.5">
              <Link href={href} className="font-mono text-xs text-yge-blue-700 hover:underline">{href}</Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
