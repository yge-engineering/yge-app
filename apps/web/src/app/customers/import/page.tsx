// /customers/import — import a customer list from a QuickBooks Online export.

import Link from 'next/link';
import { AppShell, PageHeader } from '../../../components';
import { requirePermission } from '../../../lib/permissions';
import { QboCustomerImportClient } from './qbo-customer-import-client';

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export default function CustomersImportPage() {
  requirePermission('financials:view');
  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <div className="mb-3">
          <Link href="/customers" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Customers
          </Link>
        </div>
        <PageHeader
          title="Import customers from QuickBooks"
          subtitle="Upload a QuickBooks Online customer list (CSV). We guess each customer's kind (agency, county, private, …) from the name — review and fix before saving."
        />
        <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>How to export from QuickBooks Online:</strong> Sales →
          Customers → the export icon above the list → Export to Excel, then
          save as CSV.
        </div>
        <QboCustomerImportClient apiBaseUrl={publicApiBaseUrl()} />
      </main>
    </AppShell>
  );
}
