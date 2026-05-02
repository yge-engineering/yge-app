// /punch-list/[id] — punch item detail / edit page.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { PunchItem } from '@yge/shared';
import { PunchItemEditor } from '../../../components/punch-item-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchItem(id: string): Promise<PunchItem | null> {
  const res = await fetch(`${apiBaseUrl()}/api/punch-items/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { item: PunchItem }).item;
}

export default async function PunchItemDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const item = await fetchItem(params.id);
  if (!item) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/punch-list" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Punch List
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{item.location}</h1>
      <p className="mt-1 text-sm text-gray-600">Identified {item.identifiedOn}</p>
      <p className="mt-1 text-xs text-gray-500">ID: {item.id}</p>
      <div className="mt-6">
        <PunchItemEditor mode="edit" item={item} />
      </div>

      <AuditBinderPanel entityType="PunchItem" entityId={item.id} />
    </main>
  );
}
