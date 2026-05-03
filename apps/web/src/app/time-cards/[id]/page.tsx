// /time-cards/[id] — full time card editor.

import Link from 'next/link';

import { AppShell, AuditBinderPanel } from '../../../components';
import { notFound } from 'next/navigation';
import type { Employee, Job, TimeCard } from '@yge/shared';
import { TimeCardEditor } from '@/components/time-card-editor';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchCard(id: string): Promise<TimeCard | null> {
  const res = await fetch(`${apiBaseUrl()}/api/time-cards/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return ((await res.json()) as { timeCard: TimeCard }).timeCard;
}
async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { employees: Employee[] }).employees;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function TimeCardDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [card, employees, jobs] = await Promise.all([
    fetchCard(params.id),
    fetchEmployees(),
    fetchJobs(),
  ]);
  if (!card) notFound();
  const t = getTranslator();

  return (
    <AppShell>
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <Link href="/time-cards" className="text-sm text-yge-blue-500 hover:underline">
          {t('timeCardDetail.backLink')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <TimeCardEditor
          initial={card}
          employees={employees}
          jobs={jobs}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>

      <AuditBinderPanel entityType="TimeCard" entityId={card.id} />
    </main>
    </AppShell>
  );
}
