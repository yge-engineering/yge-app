// /toolbox-talks/[id] — toolbox talk detail / edit page.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ToolboxTalk } from '@yge/shared';
import { ToolboxTalkEditor } from '../../../components/toolbox-talk-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTalk(id: string): Promise<ToolboxTalk | null> {
  const res = await fetch(`${apiBaseUrl()}/api/toolbox-talks/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { talk: ToolboxTalk }).talk;
}

export default async function ToolboxTalkDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const talk = await fetchTalk(params.id);
  if (!talk) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/toolbox-talks" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Toolbox Talks
        </Link>
        <Link
          href={`/toolbox-talks/${talk.id}/sign-in`}
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Print sign-in sheet
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{talk.topic}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {talk.heldOn} · led by {talk.leaderName}
      </p>
      <p className="mt-1 text-xs text-gray-500">ID: {talk.id}</p>
      <div className="mt-6">
        <ToolboxTalkEditor mode="edit" talk={talk} />
      </div>
    </main>
  );
}
