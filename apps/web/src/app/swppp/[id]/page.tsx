// /swppp/[id] — SWPPP inspection detail / edit page.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { SwpppInspection } from '@yge/shared';
import { SwpppInspectionEditor } from '../../../components/swppp-inspection-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspection(id: string): Promise<SwpppInspection | null> {
  const res = await fetch(`${apiBaseUrl()}/api/swppp-inspections/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { inspection: SwpppInspection }).inspection;
}

export default async function SwpppInspectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const inspection = await fetchInspection(params.id);
  if (!inspection) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/swppp" className="text-sm text-yge-blue-500 hover:underline">
          &larr; SWPPP Inspections
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        Inspection {inspection.inspectedOn}
      </h1>
      <p className="mt-1 text-sm text-gray-600">{inspection.jobId}</p>
      <p className="mt-1 text-xs text-gray-500">ID: {inspection.id}</p>
      <div className="mt-6">
        <SwpppInspectionEditor mode="edit" inspection={inspection} />
      </div>

      <AuditBinderPanel entityType="SwpppInspection" entityId={inspection.id} />
    </main>
  );
}
