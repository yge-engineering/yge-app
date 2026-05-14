import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface QualityLink {
  href: string;
  title: string;
  description: string;
}

const LINKS: QualityLink[] = [
  { href: '/customers/missing-email', title: 'Customers missing email', description: 'Records without a valid primary email.' },
  { href: '/vendors/missing-email', title: 'Vendors missing email', description: 'Vendors without a valid primary email.' },
  { href: '/jobs/missing-owner-agency', title: 'Jobs missing owner agency', description: 'Jobs with no owner agency set.' },
  { href: '/employees/missing-classification', title: 'Employees missing classification', description: 'Active employees without a classification code.' },
  { href: '/customers/on-hold', title: 'Customers on hold', description: 'Accounts flagged onHold — usually cash / credit problems.' },
  { href: '/vendors/coi-aging', title: 'Vendor COI aging', description: 'Subs with insurance close to expiration.' },
  { href: '/admin/data-status', title: 'Data status table', description: 'Master record counts per entity.' },
  { href: '/admin/data-health', title: 'Data health checks', description: 'Sanity-check rule failures across the dataset.' },
];

export default function DataQualityHubPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Data quality" subtitle="One screen with links to every data-cleanup target." />
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {LINKS.map((l) => (
            <li key={l.href} className="px-4 py-3">
              <Link href={l.href} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                {l.title}
              </Link>
              <div className="text-xs text-gray-600">{l.description}</div>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
