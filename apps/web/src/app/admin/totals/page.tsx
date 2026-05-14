import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { TotalsTiles } from './totals-panel';

export default function TotalsPage() {
  requirePermission('audit:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Totals" subtitle="Big tiles for every master table." />
        <TotalsTiles />
      </main>
    </AppShell>
  );
}
