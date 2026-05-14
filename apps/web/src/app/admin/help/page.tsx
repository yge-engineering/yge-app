import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

interface Topic { heading: string; body: React.ReactNode }

const TOPICS: Topic[] = [
  {
    heading: 'How do I add a new customer / vendor / employee?',
    body: (
      <>
        Visit{' '}
        <Link href="/customers/new" className="text-yge-blue-700 hover:underline">/customers/new</Link>,
        {' '}<Link href="/vendors/new" className="text-yge-blue-700 hover:underline">/vendors/new</Link>,
        {' '}or <Link href="/employees/new" className="text-yge-blue-700 hover:underline">/employees/new</Link>.
        {' '}For bulk additions, use the{' '}
        <Link href="/admin/csv-imports" className="text-yge-blue-700 hover:underline">CSV imports hub</Link>.
      </>
    ),
  },
  {
    heading: 'Where can I see the data health checks?',
    body: (
      <>
        <Link href="/admin/data-quality-hub" className="text-yge-blue-700 hover:underline">/admin/data-quality-hub</Link>
        {' '}indexes every missing-* page. <Link href="/admin/data-health" className="text-yge-blue-700 hover:underline">/admin/data-health</Link>
        {' '}runs rule-based sanity checks against the entire dataset.
      </>
    ),
  },
  {
    heading: 'How do I onboard a new company (multi-tenant)?',
    body: (
      <>
        Use{' '}
        <Link href="/admin/onboarding" className="text-yge-blue-700 hover:underline">/admin/onboarding</Link>
        {' '}as a checklist of the master-data records to create. Multi-tenant is on the schema,
        but only YGE is enabled in the public preview.
      </>
    ),
  },
  {
    heading: 'Where are the audit logs?',
    body: (
      <>
        Every mutation is logged server-side. The full filterable viewer is on the roadmap (see{' '}
        <Link href="/admin/audit-recent" className="text-yge-blue-700 hover:underline">/admin/audit-recent</Link>).
        For now, ask Ryan to query the log directly.
      </>
    ),
  },
  {
    heading: 'How do I export the master tables?',
    body: (
      <>
        Visit{' '}
        <Link href="/admin/csv-exports" className="text-yge-blue-700 hover:underline">/admin/csv-exports</Link>
        {' '}for one-click CSV downloads of customers, vendors, materials, equipment, cost codes,
        labor rates, employees, jobs, imported estimates, bid results, and daily reports.
      </>
    ),
  },
];

export default function AdminHelpPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Admin help" subtitle="Common admin questions, in plain English." />
        <div className="space-y-3">
          {TOPICS.map((t, i) => (
            <details key={i} className="rounded border border-gray-200 bg-white p-3 shadow-sm">
              <summary className="cursor-pointer font-semibold text-gray-900">{t.heading}</summary>
              <div className="mt-2 text-sm text-gray-700">{t.body}</div>
            </details>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
