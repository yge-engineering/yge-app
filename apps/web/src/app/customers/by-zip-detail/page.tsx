import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { ByZipDetail } from './detail-panel';

export default function ByZipDetailPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers by zip (detail)" subtitle="Expand each zip to see the customer list." />
        <ByZipDetail />
      </main>
    </AppShell>
  );
}
