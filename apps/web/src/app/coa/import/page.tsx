// /coa/import — import a chart of accounts from a QuickBooks Online export.
//
// QBO's "Account List" CSV export drops in here; we preview the mapping
// (which accounts get created, which are skipped because the number is
// taken, which rows couldn't be mapped) before committing anything.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { QboCoaImportClient } from './qbo-coa-import-client';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function CoaImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-3">
          <Link href="/coa" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Chart of accounts
          </Link>
        </div>
        <PageHeader
          title="Import from QuickBooks"
          subtitle="Upload a QuickBooks Online Account List (CSV). We map the account types, rebuild the parent hierarchy, and assign 5-digit numbers — then you review before anything is saved."
        />
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>How to export from QuickBooks Online:</strong> Accounting →
          Chart of Accounts → the dropdown by the printer icon → Export to
          Excel, then save that sheet as CSV. Account numbers are optional —
          if QuickBooks doesn&apos;t have them, we assign them by type.
        </div>
        <QboCoaImportClient apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
