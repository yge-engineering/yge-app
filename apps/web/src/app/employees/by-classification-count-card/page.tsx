import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ClassCountCardPanel } from './class-count-card-panel';

export default function EmployeesByClassCountCardPage() {
  requirePermission('employees:viewAll');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Employee classifications (count)" subtitle="One big tile with how many distinct classifications appear across the roster." />
        <p className="mb-4 text-xs text-gray-600">
          For the full list see <Link href="/employees/by-classification" className="text-yge-blue-700 hover:underline">/employees/by-classification</Link>.
        </p>
        <ClassCountCardPanel />
      </main>
    </AppShell>
  );
}
