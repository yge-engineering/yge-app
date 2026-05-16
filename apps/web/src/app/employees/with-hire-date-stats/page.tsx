import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { HireDateStatsPanel } from './hire-date-stats-panel';

export default function EmployeesWithHireDateStatsPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Employees with hire date (stats)" subtitle="How complete the hireDate field is across the employee roster." />
        <p className="mb-4 text-xs text-gray-600">
          For the lists see{' '}
          <Link href="/employees/with-hire-date" className="text-yge-blue-700 hover:underline">/employees/with-hire-date</Link>{' '}
          and <Link href="/employees/missing-hire-date" className="text-yge-blue-700 hover:underline">/employees/missing-hire-date</Link>.
        </p>
        <HireDateStatsPanel />
      </main>
    </AppShell>
  );
}
