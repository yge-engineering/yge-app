import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { EmailListClient } from './email-list-client';

export default function VendorEmailListPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <PageHeader title="Vendor email list" subtitle="All vendor (sub/supplier) emails with kind filter + BCC string." />
        <EmailListClient />
      </main>
    </AppShell>
  );
}
