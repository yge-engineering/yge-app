import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByYearStartedPanel } from './by-year-started-panel';

export default function JobsByYearStartedPage() {
  requirePermission('jobs:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Jobs by year started" subtitle="Total jobs whose start date falls in each calendar year." />
        <p className="mb-4 text-xs text-gray-600">
          Jobs with no start date bucket under <em>unknown</em>.
          See also <Link href="/jobs/by-year" className="text-yge-blue-700 hover:underline">/jobs/by-year</Link>{' '}
          (which uses contract year if start is missing) and{' '}
          <Link href="/jobs/by-month" className="text-yge-blue-700 hover:underline">/jobs/by-month</Link>.
        </p>
        <ByYearStartedPanel />
      </main>
    </AppShell>
  );
}
