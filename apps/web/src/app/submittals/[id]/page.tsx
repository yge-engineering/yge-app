// /submittals/[id] — full submittal editor.

import Link from 'next/link';
import { AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { Job, Submittal } from '@yge/shared';
import { SubmittalEditor } from '@/components/submittal-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchSubmittal(id: string): Promise<Submittal | null> {
  const res = await fetch(`${apiBaseUrl()}/api/submittals/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { submittal: Submittal }).submittal;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function SubmittalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const [submittal, jobs] = await Promise.all([fetchSubmittal(params.id), fetchJobs()]);
  if (!submittal) notFound();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/submittals" className="text-sm text-yge-blue-500 hover:underline">
          {t('newSubmittal.back')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <SubmittalEditor initial={submittal} jobs={jobs} apiBaseUrl={publicApiBaseUrl()} />
      </div>

      <AuditBinderPanel entityType="Submittal" entityId={submittal.id} />
    </main>
  );
}
