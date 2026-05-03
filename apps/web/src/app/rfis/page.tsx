// /rfis — RFI list with rollup + filters.
//
// Plain English: questions for the agency / engineer / owner with their
// written responses. Status pipeline DRAFT → SENT → ANSWERED → CLOSED.
// RFIs that touch cost or schedule get badges so they can't get lost
// when reviewing the pipeline.

import Link from 'next/link';

import {
  AppShell,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  computeRfiRollup,
  rfiDaysOutstanding,
  rfiPriorityLabel,
  rfiStatusLabel,
  rfiUrgency,
  type Job,
  type Rfi,
  type RfiStatus,
} from '@yge/shared';

const STATUSES: RfiStatus[] = ['DRAFT', 'SENT', 'ANSWERED', 'CLOSED', 'WITHDRAWN'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchRfis(filter: { jobId?: string; status?: string }): Promise<Rfi[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/rfis`);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    if (filter.status) url.searchParams.set('status', filter.status);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { rfis: Rfi[] }).rfis;
  } catch { return []; }
}
async function fetchAllRfis(): Promise<Rfi[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/rfis`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { rfis: Rfi[] }).rfis;
  } catch { return []; }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}

function statusTone(s: Rfi['status']): 'success' | 'info' | 'warn' | 'muted' | 'neutral' {
  switch (s) {
    case 'ANSWERED': return 'info';
    case 'CLOSED': return 'success';
    case 'WITHDRAWN': return 'muted';
    case 'SENT': return 'warn';
    default: return 'neutral';
  }
}
function priorityTone(p: Rfi['priority']): 'danger' | 'warn' | 'info' | 'neutral' {
  switch (p) {
    case 'CRITICAL': return 'danger';
    case 'HIGH': return 'warn';
    case 'MEDIUM': return 'info';
    default: return 'neutral';
  }
}

export default async function RfisPage({
  searchParams,
}: {
  searchParams: { jobId?: string; status?: string };
}) {
  const [rfis, all, jobs] = await Promise.all([
    fetchRfis(searchParams),
    fetchAllRfis(),
    fetchJobs(),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeRfiRollup(all);

  function buildHref(overrides: Partial<{ jobId?: string; status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.jobId) params.set('jobId', merged.jobId);
    if (merged.status) params.set('status', merged.status);
    const q = params.toString();
    return q ? `/rfis?${q}` : '/rfis';
  }
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('rfi.title')}
          subtitle={t('rfi.subtitle')}
          actions={
            <LinkButton href="/rfis/new" variant="primary" size="md">
              {t('rfi.newRfi')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('rfi.tile.open')} value={rollup.open} tone={rollup.open > 0 ? 'warn' : 'success'} />
          <Tile label={t('rfi.tile.overdue')} value={rollup.overdue} tone={rollup.overdue > 0 ? 'danger' : 'success'} />
          <Tile label={t('rfi.tile.answered')} value={rollup.answered} tone="success" />
          <Tile
            label={t('rfi.tile.avgResponse')}
            value={rollup.averageResponseDays > 0 ? rollup.averageResponseDays.toFixed(1) : '—'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('rfi.filter.status')}</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('rfi.filter.all')}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {rfiStatusLabel(s)}
            </Link>
          ))}
        </section>

        {rfis.length === 0 ? (
          <EmptyState
            title={t('rfi.empty.title')}
            body={t('rfi.empty.body')}
            actions={[{ href: '/rfis/new', label: t('rfi.empty.action'), primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('rfi.col.number')}</th>
                  <th className="px-4 py-2">{t('rfi.col.subject')}</th>
                  <th className="px-4 py-2">{t('rfi.col.job')}</th>
                  <th className="px-4 py-2">{t('rfi.col.sent')}</th>
                  <th className="px-4 py-2">{t('rfi.col.daysOut')}</th>
                  <th className="px-4 py-2">{t('rfi.col.priority')}</th>
                  <th className="px-4 py-2">{t('rfi.col.status')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rfis.map((r) => {
                  const urg = rfiUrgency(r);
                  const days = rfiDaysOutstanding(r);
                  const job = jobById.get(r.jobId);
                  const rowClass = urg === 'overdue' ? 'bg-red-50' : urg === 'dueSoon' ? 'bg-amber-50' : '';
                  return (
                    <tr key={r.id} className={rowClass}>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-gray-900">
                        <Link href={`/rfis/${r.id}`} className="text-blue-700 hover:underline">{r.rfiNumber}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.subject}</div>
                        {r.costImpact || r.scheduleImpact ? (
                          <div className="mt-0.5 flex gap-1 text-xs">
                            {r.costImpact ? <span className="inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">{t('rfi.tag.cost')}</span> : null}
                            {r.scheduleImpact ? <span className="inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-800">{t('rfi.tag.schedule')}</span> : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {job ? (
                          <Link href={`/jobs/${job.id}`} className="text-blue-700 hover:underline">{job.projectName}</Link>
                        ) : (
                          <span className="text-gray-400">{r.jobId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {r.sentAt ?? <span className="text-gray-400 font-sans">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {days === undefined ? <span className="text-gray-400 font-sans">—</span> : `${days} d`}
                      </td>
                      <td className="px-4 py-3"><StatusPill label={rfiPriorityLabel(r.priority)} tone={priorityTone(r.priority)} /></td>
                      <td className="px-4 py-3"><StatusPill label={rfiStatusLabel(r.status)} tone={statusTone(r.status)} /></td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
