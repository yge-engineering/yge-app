import Link from 'next/link';
import { AppShell, PageHeader } from '../../components';
import { requirePermission } from '../../lib/permissions';
import { CompletenessPanel } from './completeness-panel';

export default function AtAGlanceCompletenessPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Master-data completeness" subtitle="How filled-in each entity's canonical fields are, side-by-side." />
        <p className="mb-4 text-xs text-gray-600">
          See also <Link href="/at-a-glance-grade" className="text-yge-blue-700 hover:underline">/at-a-glance-grade</Link>{' '}
          and <Link href="/at-a-glance-missing" className="text-yge-blue-700 hover:underline">/at-a-glance-missing</Link>.
        </p>
        <CompletenessPanel />
      </main>
    </AppShell>
  );
}
