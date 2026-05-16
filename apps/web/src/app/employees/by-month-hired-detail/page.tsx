import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthHiredDetailPanel } from './by-month-hired-detail-panel';

export default function EmployeesByMonthHiredDetailPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees by month hired (detail)" subtitle="Each YYYY-MM month expands to the actual employees hired in it." />
        <p className="mb-4 text-xs text-gray-600">
          Drill-down for{' '}
          <Link href="/employees/by-month-hired" className="text-yge-blue-700 hover:underline">/employees/by-month-hired</Link>.
        </p>
        <ByMonthHiredDetailPanel />
      </main>
    </AppShell>
  );
}
