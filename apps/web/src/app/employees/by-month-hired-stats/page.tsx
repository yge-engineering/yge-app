import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MonthHiredStatsPanel } from './month-hired-stats-panel';

export default function EmployeesByMonthHiredStatsPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees by month hired (stats)" subtitle="Quick stats card: busiest hire month, unique months, missing hire dates." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see{' '}
          <Link href="/employees/by-month-hired" className="text-yge-blue-700 hover:underline">/employees/by-month-hired</Link>{' '}
          and <Link href="/employees/by-month-hired-detail" className="text-yge-blue-700 hover:underline">/employees/by-month-hired-detail</Link>.
        </p>
        <MonthHiredStatsPanel />
      </main>
    </AppShell>
  );
}
