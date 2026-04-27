// /mileage/[id] — mileage entry detail / edit.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { MileageEntry } from '@yge/shared';
import { MileageEntryEditor } from '../../../components/mileage-entry-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEntry(id: string): Promise<MileageEntry | null> {
  const res = await fetch(`${apiBaseUrl()}/api/mileage/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { entry: MileageEntry }).entry;
}

export default async function MileageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const entry = await fetchEntry(params.id);
  if (!entry) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/mileage" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Mileage Log
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{entry.tripDate}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {entry.employeeName} · {entry.vehicleDescription}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {entry.id}</p>
      <div className="mt-6">
        <MileageEntryEditor mode="edit" entry={entry} />
      </div>
    </main>
  );
}
