import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ThreeUp } from './three-up-panel';

export default function ThreeUpPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Three-up" subtitle="Three giant tiles: lifetime wins, win rate, won \$. Print this." />
        <ThreeUp />
      </main>
    </AppShell>
  );
}
