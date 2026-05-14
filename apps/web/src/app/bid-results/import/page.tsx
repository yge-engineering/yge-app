import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { BidResultImportForm } from './bid-result-import-form';

export default function BidResultImportPage() {
  requirePermission('estimates:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Import bid results" subtitle="CSV with jobNumber, bidOpenedAt, bidderName, bidderAmount." />
        <BidResultImportForm />
      </main>
    </AppShell>
  );
}
