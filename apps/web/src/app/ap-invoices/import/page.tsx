// /ap-invoices/import — import open payables from a QuickBooks export.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { QboApImportClient } from './qbo-ap-import-client';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function ApImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-3">
          <Link href="/ap-invoices" className="text-sm text-yge-blue-500 hover:underline">
            &larr; AP invoices
          </Link>
        </div>
        <PageHeader
          title="Import open A/P from QuickBooks"
          subtitle="Upload a QuickBooks Online A/P Aging Detail (or Unpaid Bills) CSV. Each unpaid bill becomes an approved open payable so your AP aging is right on day one."
        />
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>How to export from QuickBooks Online:</strong> Reports →
          &ldquo;A/P Aging Detail&rdquo; → set the report date to your cutover
          date → Export to Excel, then save as CSV. Imported bills land as
          Approved (ready to pay); re-code their GL account as needed.
        </div>
        <QboApImportClient apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
