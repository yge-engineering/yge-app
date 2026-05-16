import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { RateTypeCountCardPanel } from './rate-type-count-card-panel';

export default function EmployeesByRateTypeCountCardPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Employee rate types (count)" subtitle="One big tile with how many distinct rate types appear across the roster." />
        <p className="mb-4 text-xs text-gray-600">
          For the breakdown see <Link href="/employees/by-rate-type" className="text-yge-blue-700 hover:underline">/employees/by-rate-type</Link>.
        </p>
        <RateTypeCountCardPanel />
      </main>
    </AppShell>
  );
}
