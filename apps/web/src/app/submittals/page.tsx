// /submittals — submittal list with rollup + filters.
//
// Plain English: shop drawings, product data, samples, certs sent to
// the engineer for review. Block-ordering flags surface materials
// that can't ship until the submittal's back — without that visual,
// it's easy to lose two weeks of schedule waiting on a stamp.

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
  computeSubmittalRollup,
  submittalDaysOutstanding,
  submittalKindLabel,
  submittalStatusLabel,
  submittalUrgency,
  type Job,
  type Submittal,
  type SubmittalStatus,
} from '@yge/shared';

const STATUSES: SubmittalStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REVISE_RESUBMIT',
  'REJECTED',
  'WITHDRAWN',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchSubmittals(filter: { jobId?: string; status?: string }): Promise<Submittal[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/submittals`);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    if (filter.status) url.searchParams.set('status', filter.status);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { submittals: Submittal[] }).submittals;
  } catch { return []; }
}
async function fetchAllSubmittals(): Promise<Submittal[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/submittals`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { submittals: Submittal[] }).submittals;
  } catch { return []; }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}

function statusTone(s: SubmittalStatus): 'success' | 'info' | 'warn' | 'danger' | 'muted' | 'neutral' {
  switch (s) {
    case 'APPROVED':
    case 'APPROVED_AS_NOTED': return 'success';
    case 'SUBMITTED': return 'info';
    case 'REVISE_RESUBMIT': return 'warn';
    case 'REJECTED': return 'danger';
    case 'WITHDRAWN': return 'muted';
    default: return 'neutral';
  }
}

export default async function SubmittalsPage({
  searchParams,
}: {
  searchParams: { jobId?: string; status?: string };
}) {
  const [submittals, all, jobs] = await Promise.all([
    fetchSubmittals(searchParams),
    fetchAllSubmittals(),
    fetchJobs(),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeSubmittalRollup(all);

  function buildHref(overrides: Partial<{ jobId?: string; status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.jobId) params.set('jobId', merged.jobId);
    if (merged.status) params.set('status', merged.status);
    const q = params.toString();
    return q ? `/submittals?${q}` : '/submittals';
  }
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('submittals.title')}
          subtitle={t('submittals.subtitle')}
          actions={
            <LinkButton href="/submittals/new" variant="primary" size="md">
              {t('submittals.newSubmittal')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('submittals.tile.open')} value={rollup.open} tone={rollup.open > 0 ? 'warn' : 'success'} />
          <Tile label={t('submittals.tile.overdue')} value={rollup.overdue} tone={rollup.overdue > 0 ? 'danger' : 'success'} />
          <Tile
            label={t('submittals.tile.blocksOrdering')}
            value={rollup.blocksOrderingOpen}
            tone={rollup.blocksOrderingOpen > 0 ? 'danger' : 'success'}
            warnText={rollup.blocksOrderingOpen > 0 ? t('submittals.tile.blocksOrdering.warn') : undefined}
          />
          <Tile
            label={t('submittals.tile.avgReturn')}
            value={rollup.averageReturnDays > 0 ? rollup.averageReturnDays.toFixed(1) : '—'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('submittals.filter.status')}</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('submittals.filter.all')}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {submittalStatusLabel(s)}
            </Link>
          ))}
        </section>

        {submittals.length === 0 ? (
          <EmptyState
            title={t('submittals.empty.title')}
            body={t('submittals.empty.body')}
            actions={[{ href: '/submittals/new', label: t('submittals.empty.action'), primary: true }]}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">{t('submittals.col.number')}</th>
                  <th className="px-4 py-2">{t('submittals.col.subject')}</th>
                  <th className="px-4 py-2">{t('submittals.col.job')}</th>
                  <th className="px-4 py-2">{t('submittals.col.submitted')}</th>
                  <th className="px-4 py-2">{t('submittals.col.daysOut')}</th>
                  <th className="px-4 py-2">{t('submittals.col.status')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submittals.map((s) => {
                  const urg = submittalUrgency(s);
                  const days = submittalDaysOutstanding(s);
                  const job = jobById.get(s.jobId);
                  const rowClass = urg === 'overdue' ? 'bg-red-50' : urg === 'dueSoon' ? 'bg-amber-50' : '';
                  return (
                    <tr key={s.id} className={rowClass}>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-gray-900">
                        <Link href={`/submittals/${s.id}`} className="text-blue-700 hover:underline">{s.submittalNumber}</Link>
                        {s.revision ? <span className="ml-1 text-gray-500">Rev {s.revision}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.subject}</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {submittalKindLabel(s.kind)}
                          {s.specSection ? <> · {s.specSection}</> : null}
                        </div>
                        {s.blocksOrdering ? (
                          <span className="mt-0.5 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800">
                            blocks ordering
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {job ? (
                          <Link href={`/jobs/${job.id}`} className="text-blue-700 hover:underline">{job.projectName}</Link>
                        ) : (
                          <span className="text-gray-400">{s.jobId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {s.submittedAt ?? <span className="text-gray-400 font-sans">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {days === undefined ? <span className="text-gray-400 font-sans">—</span> : `${days} d`}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill label={submittalStatusLabel(s.status)} tone={statusTone(s.status)} />
                      </td>
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
