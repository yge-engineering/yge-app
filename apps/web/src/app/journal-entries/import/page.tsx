// /journal-entries/import — import GL opening balances from a QuickBooks
// Trial Balance export. Builds one balanced journal entry as of the cutover
// date and saves it as a DRAFT for review + posting.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { QboTrialBalanceImportClient } from './qbo-trial-balance-import-client';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function JournalEntriesImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-3">
          <Link href="/journal-entries" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Journal entries
          </Link>
        </div>
        <PageHeader
          title="Import opening balances from QuickBooks"
          subtitle="Upload a QuickBooks Online Trial Balance (CSV) as of your cutover date. We match each account to your chart of accounts and build ONE balanced opening journal entry — saved as a draft for you to review and post."
        />
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>How to export from QuickBooks Online:</strong> Reports →
          &ldquo;Trial Balance&rdquo; → set the report date to your cutover date
          → Export to Excel, then save as CSV. Import the chart of accounts
          first so the accounts match; anything unmatched is absorbed by
          Opening Balance Equity and flagged for you to map.
        </div>
        <QboTrialBalanceImportClient apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
