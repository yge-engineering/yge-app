// /dispatch/[id] — dispatch detail / edit page.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Dispatch } from '@yge/shared';
import { DispatchEditor } from '../../../components/dispatch-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchDispatch(id: string): Promise<Dispatch | null> {
  const res = await fetch(`${apiBaseUrl()}/api/dispatches/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { dispatch: Dispatch }).dispatch;
}

export default async function DispatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const dispatch = await fetchDispatch(params.id);
  if (!dispatch) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dispatch" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dispatch Board
        </Link>
        <Link
          href={`/dispatch/${dispatch.id}/handout`}
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Print handout
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {dispatch.scheduledFor}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {dispatch.jobId} · foreman {dispatch.foremanName}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {dispatch.id}</p>
      <div className="mt-6">
        <DispatchEditor mode="edit" dispatch={dispatch} />
      </div>
    </main>
  );
}
