// /vendors/[id] — vendor detail / edit page.

import Link from 'next/link';

import { AppShell, AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { Vendor } from '@yge/shared';
import { VendorEditor } from '../../../components/vendor-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchVendor(id: string): Promise<Vendor | null> {
  const res = await fetch(`${apiBaseUrl()}/api/vendors/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json()) as { vendor: Vendor };
  return body.vendor;
}

export default async function VendorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const vendor = await fetchVendor(params.id);
  if (!vendor) notFound();

  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/vendors" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Vendors
        </Link>
        {vendor.kind === 'SUBCONTRACTOR' && (
          <Link
            href={`/vendors/${vendor.id}/prequal`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Prequal packet
          </Link>
        )}
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {vendor.dbaName ?? vendor.legalName}
      </h1>
      {vendor.dbaName && (
        <p className="mt-1 text-sm text-gray-600">Legal: {vendor.legalName}</p>
      )}
      <p className="mt-2 text-xs text-gray-500">ID: {vendor.id}</p>
      <div className="mt-6">
        <VendorEditor mode="edit" vendor={vendor} />
      </div>

      <AuditBinderPanel entityType="Vendor" entityId={vendor.id} />
    </main>
    </AppShell>
  );
}
