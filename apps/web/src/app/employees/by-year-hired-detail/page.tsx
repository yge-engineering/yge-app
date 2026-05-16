import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByYearHiredDetailPanel } from './by-year-hired-detail-panel';

export default function EmployeesByYearHiredDetailPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees by year hired (detail)" subtitle="Each hire year expands to the actual employees brought on that year." />
        <p className="mb-4 text-xs text-gray-600">
          Drill-down for{' '}
          <Link href="/employees/by-year-hired" className="text-yge-blue-700 hover:underline">/employees/by-year-hired</Link>.
        </p>
        <ByYearHiredDetailPanel />
      </main>
    </AppShell>
  );
}
