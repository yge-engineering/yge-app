import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CoverageSummary } from './summary-panel';

export default function CoverageSummaryPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Coverage summary" subtitle="A single bar chart of cleanup coverage per entity." />
        <CoverageSummary />
        <p className="mt-3 text-xs text-gray-500">
          Per-field detail at{' '}
          <Link href="/admin/cleanup-progress" className="text-yge-blue-700 hover:underline">/admin/cleanup-progress</Link>{' '}
          ·{' '}
          <Link href="/admin/data-quality-grade" className="text-yge-blue-700 hover:underline">/admin/data-quality-grade</Link>.
        </p>
      </main>
    </AppShell>
  );
}
