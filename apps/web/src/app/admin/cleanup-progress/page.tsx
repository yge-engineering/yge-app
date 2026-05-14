import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ProgressPanel } from './progress-panel';

export default function CleanupProgressPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Cleanup progress" subtitle="What percent of each entity has the key fields filled in." />
        <ProgressPanel />
      </main>
    </AppShell>
  );
}
