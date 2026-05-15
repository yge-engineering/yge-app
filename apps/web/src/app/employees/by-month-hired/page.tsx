import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByMonthHiredPanel } from './by-month-hired-panel';

export default function EmployeesByMonthHiredPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees by month hired" subtitle="How many people you brought on each calendar month." />
        <p className="mb-4 text-xs text-gray-600">
          Employees with no hire date bucket under <em>unknown</em>.
          See also <Link href="/employees/missing-hire-date" className="text-yge-blue-700 hover:underline">/employees/missing-hire-date</Link>{' '}
          and <Link href="/employees/with-hire-date" className="text-yge-blue-700 hover:underline">/employees/with-hire-date</Link>.
        </p>
        <ByMonthHiredPanel />
      </main>
    </AppShell>
  );
}
