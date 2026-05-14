import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';

export default function AuditRecentPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Recent audit events" subtitle="Read-only window into the audit log." />
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
          The full audit log lives at{' '}
          <Link href="/admin" className="text-yge-blue-700 hover:underline">/admin</Link>
          {' '}— this dedicated page is a placeholder while the dedicated /admin/audit-log
          (with filters by user / entity / date) is being built. Every mutation across the app
          is already being logged server-side via the middleware in apps/api/src/middleware/audit.
        </p>
      </main>
    </AppShell>
  );
}
