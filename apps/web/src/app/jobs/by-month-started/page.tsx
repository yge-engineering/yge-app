import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthStartedPanel } from './by-month-started-panel';

export default function JobsByMonthStartedPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by month started" subtitle="Total jobs whose start date falls in each calendar month (YYYY-MM)." />
        <p className="mb-4 text-xs text-gray-600">
          Jobs with no start date bucket under <em>unknown</em>.
          See also <Link href="/jobs/by-year-started" className="text-yge-blue-700 hover:underline">/jobs/by-year-started</Link>{' '}
          and <Link href="/jobs/by-month" className="text-yge-blue-700 hover:underline">/jobs/by-month</Link>.
        </p>
        <ByMonthStartedPanel />
      </main>
    </AppShell>
  );
}
