import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Step { title: string; status: 'shipped' | 'planned'; body: React.ReactNode }

const STEPS: Step[] = [
  {
    title: '1. Company profile',
    status: 'shipped',
    body: (
      <>
        Set legal name, addresses, license numbers in{' '}
        <Link href="/admin/company-info" className="text-yge-blue-700 hover:underline">company-info</Link>.
      </>
    ),
  },
  {
    title: '2. Bring in master data',
    status: 'shipped',
    body: (
      <>
        Use the <Link href="/admin/csv-imports" className="text-yge-blue-700 hover:underline">CSV imports hub</Link>
        {' '}to bulk-load customers, vendors, materials, equipment, and cost codes.
      </>
    ),
  },
  {
    title: '3. Add staff roster',
    status: 'shipped',
    body: (
      <>
        Visit <Link href="/employees/new" className="text-yge-blue-700 hover:underline">/employees/new</Link>
        {' '}or bulk import. Verify classifications via{' '}
        <Link href="/employees/missing-classification" className="text-yge-blue-700 hover:underline">missing-classification</Link>.
      </>
    ),
  },
  {
    title: '4. Configure rate book',
    status: 'shipped',
    body: (
      <>
        Owned + rental equipment at <Link href="/equipment-rates" className="text-yge-blue-700 hover:underline">/equipment-rates</Link>.
        {' '}Labor at <Link href="/labor-rates" className="text-yge-blue-700 hover:underline">/labor-rates</Link>.
      </>
    ),
  },
  {
    title: '5. Auth + roles',
    status: 'planned',
    body: <>Multi-tenant auth + per-user roles. Currently single-tenant YGE.</>,
  },
  {
    title: '6. Bond / insurance / banking',
    status: 'planned',
    body: <>Bond limit tracker (preview at <Link href="/admin/bond-capacity" className="text-yge-blue-700 hover:underline">/admin/bond-capacity</Link>), COI tracker, banking integration.</>,
  },
  {
    title: '7. Portal access',
    status: 'planned',
    body: (
      <>
        Invite agency owners + sub portal users via{' '}
        <Link href="/admin/portal-users" className="text-yge-blue-700 hover:underline">portal-users</Link>.
      </>
    ),
  },
];

const TONE: Record<Step['status'], string> = {
  shipped: 'bg-green-100 text-green-800',
  planned: 'bg-gray-200 text-gray-700',
};

export default function SetupWizardPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Setup wizard" subtitle="Step-by-step onboarding for a new company tenant." />
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900">{s.title}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TONE[s.status]}`}>
                  {s.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-700">{s.body}</div>
            </li>
          ))}
        </ol>
      </main>
    </AppShell>
  );
}
