import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ClassRateDetailPanel } from './class-rate-detail-panel';

export default function EmployeesByClassRateDetailPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Employees by classification + rate type (detail)" subtitle="Each classification x rate type cell expands to the actual employees in it." />
        <p className="mb-4 text-xs text-gray-600">
          Drill-down for{' '}
          <Link href="/employees/by-classification-and-rate-type" className="text-yge-blue-700 hover:underline">/employees/by-classification-and-rate-type</Link>.
        </p>
        <ClassRateDetailPanel />
      </main>
    </AppShell>
  );
}
