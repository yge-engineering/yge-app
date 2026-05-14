import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { CoiAgingTable } from './coi-aging-table';

export default function CoiAgingPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl">
        <PageHeader
          title="COI aging — subs"
          subtitle="Certificates of insurance about to expire or already lapsed."
        />
        <CoiAgingTable />
      </main>
    </AppShell>
  );
}
