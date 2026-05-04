// /change-orders/[id] — full CO editor.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuditBinderPanel } from '../../../components';
import type { ChangeOrder, Job, Rfi } from '@yge/shared';
import { ChangeOrderEditor } from '@/components/change-order-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchCo(id: string): Promise<ChangeOrder | null> {
  const res = await fetch(`${apiBaseUrl()}/api/change-orders/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { changeOrder: ChangeOrder }).changeOrder;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}
async function fetchRfis(jobId: string): Promise<Rfi[]> {
  const url = new URL(`${apiBaseUrl()}/api/rfis`);
  url.searchParams.set('jobId', jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { rfis: Rfi[] }).rfis;
}

export default async function ChangeOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const co = await fetchCo(params.id);
  if (!co) notFound();
  const [jobs, rfis] = await Promise.all([fetchJobs(), fetchRfis(co.jobId)]);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/change-orders" className="text-sm text-yge-blue-500 hover:underline">
          {t('newCo.back')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ChangeOrderEditor
          initial={co}
          jobs={jobs}
          rfis={rfis}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>

      <AuditBinderPanel entityType="ChangeOrder" entityId={co.id} />
    </main>
  );
}
