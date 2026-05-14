import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { VisitedPanel } from './visited-panel';

export default function VisitedPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Visited pages" subtitle="Read-only list of pages you have manually marked as visited (local storage only)." />
        <VisitedPanel />
      </main>
    </AppShell>
  );
}
