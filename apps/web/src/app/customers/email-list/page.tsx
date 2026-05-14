import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { EmailListClient } from './email-list-client';

export default function CustomerEmailListPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Customer email list" subtitle="All customer contact emails + copy-to-clipboard BCC string." />
        <EmailListClient />
      </main>
    </AppShell>
  );
}
