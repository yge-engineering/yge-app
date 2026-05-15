import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ChecklistPanel } from './checklist-panel';

export default function CleanupChecklistV2Page() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Cleanup checklist v2" subtitle="What's left to fix on the master data so reports stop showing 'unknown'." />
        <p className="mb-4 text-xs text-gray-600">
          Each section lists how many records are missing a common field and links straight to the page where you can fix them.
          See also <Link href="/admin/cleanup-progress" className="text-yge-blue-700 hover:underline">/admin/cleanup-progress</Link>{' '}
          and <Link href="/admin/data-quality-counts" className="text-yge-blue-700 hover:underline">/admin/data-quality-counts</Link>.
        </p>
        <ChecklistPanel />
      </main>
    </AppShell>
  );
}
