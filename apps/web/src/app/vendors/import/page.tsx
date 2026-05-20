// /vendors/import — import a vendor list from a QuickBooks Online export.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { QboVendorImportClient } from './qbo-vendor-import-client';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function VendorsImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-3">
          <Link href="/vendors" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Vendors
          </Link>
        </div>
        <PageHeader
          title="Import vendors from QuickBooks"
          subtitle="Upload a QuickBooks Online vendor list (CSV). We guess each vendor's kind and 1099 status, normalize payment terms, and carry the tax ID across — review before saving."
        />
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>How to export from QuickBooks Online:</strong> Expenses →
          Vendors → the export icon above the list → Export to Excel, then save
          as CSV. The &ldquo;Track 1099&rdquo; column is honored when present.
        </div>
        <QboVendorImportClient apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
