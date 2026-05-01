// /lien-waivers/[id] — waiver detail / edit page.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { notFound } from 'next/navigation';
import {
  lienWaiverKindLabel,
  type LienWaiver,
} from '@yge/shared';
import { LienWaiverEditor } from '../../../components/lien-waiver-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchWaiver(id: string): Promise<LienWaiver | null> {
  const res = await fetch(`${apiBaseUrl()}/api/lien-waivers/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { waiver: LienWaiver }).waiver;
}

export default async function LienWaiverDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const waiver = await fetchWaiver(params.id);
  if (!waiver) notFound();

  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/lien-waivers" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Lien Waivers
        </Link>
        <Link
          href={`/lien-waivers/${waiver.id}/print`}
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Print statutory form
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {lienWaiverKindLabel(waiver.kind)}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {waiver.jobName} · through {waiver.throughDate}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {waiver.id}</p>
      <div className="mt-6">
        <LienWaiverEditor mode="edit" waiver={waiver} />
      </div>
    </main>
    </AppShell>
  );
}
