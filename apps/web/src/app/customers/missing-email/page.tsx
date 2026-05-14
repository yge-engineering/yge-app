import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { MissingEmailTable } from './missing-email-table';

export default function MissingEmailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers missing email" subtitle="Records where the primary email is empty — data-quality cleanup target." />
        <MissingEmailTable />
      </main>
    </AppShell>
  );
}
