// /ar-invoices/import — import open receivables from a QuickBooks export.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { QboArImportClient } from './qbo-ar-import-client';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function ArImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-3">
          <Link href="/ar-invoices" className="text-sm text-yge-blue-500 hover:underline">
            &larr; AR invoices
          </Link>
        </div>
        <PageHeader
          title="Import open A/R from QuickBooks"
          subtitle="Upload a QuickBooks Online A/R Aging Detail (or Open Invoices) CSV. Each unpaid invoice becomes an open receivable so your aging report is right on day one."
        />
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>How to export from QuickBooks Online:</strong> Reports →
          &ldquo;A/R Aging Detail&rdquo; → set the report date to your cutover
          date → Export to Excel, then save as CSV. Imported invoices are
          parked on a &ldquo;qbo-migration&rdquo; job until you re-assign them.
        </div>
        <QboArImportClient apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
