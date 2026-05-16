import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { YearHiredStatsPanel } from './year-hired-stats-panel';

export default function EmployeesByYearHiredStatsPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees by year hired (stats)" subtitle="Quick stats card: busiest hire year, unique years, missing hire dates." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see{' '}
          <Link href="/employees/by-year-hired" className="text-yge-blue-700 hover:underline">/employees/by-year-hired</Link>{' '}
          and <Link href="/employees/by-year-hired-detail" className="text-yge-blue-700 hover:underline">/employees/by-year-hired-detail</Link>.
        </p>
        <YearHiredStatsPanel />
      </main>
    </AppShell>
  );
}
