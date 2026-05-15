import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TwoDPanel } from './two-d-panel';

export default function EmployeesByClassRatePage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees by classification + rate type" subtitle="2D grid: classification down the side, rate type across the top." />
        <p className="mb-4 text-xs text-gray-600">
          Helpful for spotting unusual combos (e.g. a 'Salary' Equipment Operator). Drill down via{' '}
          <Link href="/employees/by-classification" className="text-yge-blue-700 hover:underline">/employees/by-classification</Link>{' '}
          and <Link href="/employees" className="text-yge-blue-700 hover:underline">/employees</Link>.
        </p>
        <TwoDPanel />
      </main>
    </AppShell>
  );
}
