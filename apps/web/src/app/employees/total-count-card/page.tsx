import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TotalCountCardPanel } from './total-count-card-panel';

export default function EmployeesTotalCountCardPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Total employees" subtitle="One big tile with the total employee count." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/employees" className="text-yge-blue-700 hover:underline">/employees</Link>.
          For breakdowns see{' '}
          <Link href="/employees/by-classification" className="text-yge-blue-700 hover:underline">/employees/by-classification</Link>,{' '}
          <Link href="/employees/by-rate-type" className="text-yge-blue-700 hover:underline">/employees/by-rate-type</Link>.
        </p>
        <TotalCountCardPanel />
      </main>
    </AppShell>
  );
}
