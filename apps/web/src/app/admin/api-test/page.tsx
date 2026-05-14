import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ApiTestPanel } from './api-test-panel';

export default function ApiTestPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="API test" subtitle="Hit every analytic endpoint and show pass/fail. Click 'Run all' to test." />
        <ApiTestPanel />
      </main>
    </AppShell>
  );
}
