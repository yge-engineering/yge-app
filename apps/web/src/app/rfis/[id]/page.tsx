// /rfis/[id] — full RFI editor.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Job, Rfi } from '@yge/shared';
import { RfiEditor } from '@/components/rfi-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchRfi(id: string): Promise<Rfi | null> {
  const res = await fetch(`${apiBaseUrl()}/api/rfis/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { rfi: Rfi }).rfi;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function RfiDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [rfi, jobs] = await Promise.all([fetchRfi(params.id), fetchJobs()]);
  if (!rfi) notFound();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/rfis" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to RFIs
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <RfiEditor initial={rfi} jobs={jobs} apiBaseUrl={publicApiBaseUrl()} />
      </div>
    </main>
  );
}
