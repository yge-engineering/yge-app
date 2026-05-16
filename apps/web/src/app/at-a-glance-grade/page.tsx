import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';
import { GradePanel } from './grade-panel';

export default function AtAGlanceGradePage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <PageHeader title="Data quality grade" subtitle="One letter grade summarising how complete the master data is across customers, vendors, jobs, employees." />
        <p className="mb-4 text-xs text-gray-600">
          A = 95%+ complete · B = 85-94% · C = 70-84% · D = 50-69% · F = below 50%.
          For the breakdown see{' '}
          <Link href="/at-a-glance-missing" className="text-yge-blue-700 hover:underline">/at-a-glance-missing</Link>{' '}
          and <Link href="/admin/data-quality-grade" className="text-yge-blue-700 hover:underline">/admin/data-quality-grade</Link>.
        </p>
        <GradePanel />
      </main>
    </AppShell>
  );
}
