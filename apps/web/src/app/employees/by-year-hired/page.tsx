import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByYearHiredPanel } from './by-year-hired-panel';

export default function EmployeesByYearHiredPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees by year hired" subtitle="Total hires bucketed by hire year — useful for tenure and turnover review." />
        <p className="mb-4 text-xs text-gray-600">
          Employees with no hire date bucket under <em>unknown</em>.
          See also <Link href="/employees/by-month-hired" className="text-yge-blue-700 hover:underline">/employees/by-month-hired</Link>{' '}
          and <Link href="/employees/missing-hire-date" className="text-yge-blue-700 hover:underline">/employees/missing-hire-date</Link>.
        </p>
        <ByYearHiredPanel />
      </main>
    </AppShell>
  );
}
