// /dir-rates/[id] — DIR rate detail / edit.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import { classificationLabel, type DirRate } from '@yge/shared';
import { DirRateEditor } from '../../../components/dir-rate-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchRate(id: string): Promise<DirRate | null> {
  const res = await fetch(`${apiBaseUrl()}/api/dir-rates/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { rate: DirRate }).rate;
}

export default async function DirRateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const rate = await fetchRate(params.id);
  if (!rate) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/dir-rates" className="text-sm text-yge-blue-500 hover:underline">
          &larr; DIR Rates
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {classificationLabel(rate.classification)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {rate.county} · effective {rate.effectiveDate}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {rate.id}</p>
      <div className="mt-6">
        <DirRateEditor mode="edit" rate={rate} />
      </div>

      <AuditBinderPanel entityType="DirRateSchedule" entityId={rate.id} />
    </main>
  );
}
