// /certified-payrolls — CPR list with rollup.
//
// Plain English: California DIR weekly certified payroll. Required
// during prevailing-wage work. Submit-blockers check before submission
// ensures every row has hours, rates, and the statement of compliance
// is signed.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  computeCprRollup,
  cprStatusLabel,
  type CertifiedPayroll,
  type CprStatus,
  type Job,
} from '@yge/shared';

const STATUSES: CprStatus[] = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'AMENDED', 'NON_PERFORMANCE'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchCprs(filter: { jobId?: string; status?: string }): Promise<CertifiedPayroll[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/certified-payrolls`);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    if (filter.status) url.searchParams.set('status', filter.status);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { certifiedPayrolls: CertifiedPayroll[] }).certifiedPayrolls;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<CertifiedPayroll[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/certified-payrolls`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { certifiedPayrolls: CertifiedPayroll[] }).certifiedPayrolls;
  } catch {
    return [];
  }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch {
    return [];
  }
}

function statusTone(s: CprStatus): 'success' | 'info' | 'warn' | 'muted' | 'neutral' {
  switch (s) {
    case 'ACCEPTED': return 'success';
    case 'SUBMITTED':
    case 'AMENDED': return 'info';
    case 'NON_PERFORMANCE': return 'muted';
    case 'DRAFT': return 'warn';
    default: return 'neutral';
  }
}

export default async function CertifiedPayrollsPage({
  searchParams,
}: {
  searchParams: { jobId?: string; status?: string };
}) {
  const [cprs, all, jobs] = await Promise.all([
    fetchCprs(searchParams),
    fetchAll(),
    fetchJobs(),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeCprRollup(all);

  function buildHref(overrides: Partial<{ jobId?: string; status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.jobId) params.set('jobId', merged.jobId);
    if (merged.status) params.set('status', merged.status);
    const q = params.toString();
    return q ? `/certified-payrolls?${q}` : '/certified-payrolls';
  }
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('cpr.title')}
          subtitle={t('cpr.subtitle')}
          actions={
            <LinkButton href="/certified-payrolls/new" variant="primary" size="md">
              {t('cpr.newCpr')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('cpr.tile.total')} value={rollup.total} />
          <Tile label={t('cpr.tile.draft')} value={rollup.draft} tone={rollup.draft > 0 ? 'warn' : 'success'} />
          <Tile label={t('cpr.tile.accepted')} value={rollup.accepted} tone="success" />
          <Tile label={t('cpr.tile.totalGross')} value={<Money cents={rollup.totalGrossPayCents} />} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('cpr.filter.status')}</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('cpr.filter.all')}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {cprStatusLabel(s)}
            </Link>
          ))}
        </section>

        {cprs.length === 0 ? (
          <EmptyState
            title={t('cpr.empty.title')}
            body={t('cpr.empty.body')}
            actions={[{ href: '/certified-payrolls/new', label: t('cpr.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={cprs}
            keyFn={(c) => c.id}
            columns={[
              {
                key: 'payrollNumber',
                header: t('cpr.col.payrollNumber'),
                cell: (c) => (
                  <Link href={`/certified-payrolls/${c.id}`} className="font-mono font-bold text-gray-900 hover:underline">
                    {c.payrollNumber}
                    {c.isFinalPayroll ? <span className="ml-1 text-xs text-orange-700">{t('cpr.final')}</span> : null}
                  </Link>
                ),
              },
              { key: 'week', header: t('cpr.col.week'), cell: (c) => <span className="text-sm text-gray-700">{c.weekStarting} → {c.weekEnding}</span> },
              {
                key: 'job',
                header: t('cpr.col.job'),
                cell: (c) => {
                  const job = jobById.get(c.jobId);
                  return job ? (
                    <Link href={`/jobs/${job.id}`} className="text-sm text-blue-700 hover:underline">{job.projectName}</Link>
                  ) : (
                    <span className="text-sm text-gray-400">{c.jobId}</span>
                  );
                },
              },
              {
                key: 'projectNumber',
                header: t('cpr.col.projectNumber'),
                cell: (c) => c.projectNumber ? <span className="font-mono text-sm text-gray-700">{c.projectNumber}</span> : <span className="text-sm text-gray-400">—</span>,
              },
              { key: 'rows', header: t('cpr.col.rows'), numeric: true, cell: (c) => <span className="text-sm text-gray-700">{c.rows.length}</span> },
              {
                key: 'status',
                header: t('cpr.col.status'),
                cell: (c) => <StatusPill label={cprStatusLabel(c.status)} tone={statusTone(c.status)} />,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
