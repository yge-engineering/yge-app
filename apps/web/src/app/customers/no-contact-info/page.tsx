import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { NoContactTable } from './no-contact-table';

export default function NoContactInfoPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader title="Customers with no contact info" subtitle="Records that have neither an email nor a phone — unreachable." />
        <NoContactTable />
      </main>
    </AppShell>
  );
}
