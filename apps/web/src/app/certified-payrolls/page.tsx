// /certified-payrolls — CPR list with rollup.

import Link from 'next/link';
import {
  computeCprRollup,
  cprStatusLabel,
  formatUSD,
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
  const url = new URL(`${apiBaseUrl()}/api/certified-payrolls`);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  if (filter.status) url.searchParams.set('status', filter.status);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { certifiedPayrolls: CertifiedPayroll[] }).certifiedPayrolls;
}
async function fetchAll(): Promise<CertifiedPayroll[]> {
  const res = await fetch(`${apiBaseUrl()}/api/certified-payrolls`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { certifiedPayrolls: CertifiedPayroll[] }).certifiedPayrolls;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
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

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/certified-payrolls/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New CPR
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Certified payroll records</h1>
      <p className="mt-2 text-gray-700">
        California DIR weekly certified payroll. Required during prevailing
        wage work. Submit-blockers check before submission ensures every
        row has hours, rates, and the statement of compliance is signed.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="Draft" value={rollup.draft} variant={rollup.draft > 0 ? 'warn' : 'ok'} />
        <Stat label="Accepted" value={rollup.accepted} variant="ok" />
        <Stat label="Total gross paid" value={formatUSD(rollup.totalGrossPayCents)} />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
        <Link
          href={buildHref({ status: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {cprStatusLabel(s)}
          </Link>
        ))}
      </section>

      {cprs.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No CPRs yet. Click <em>New CPR</em> to start a weekly filing.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Payroll #</th>
                <th className="px-4 py-2">Week</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2">Project #</th>
                <th className="px-4 py-2">Rows</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cprs.map((c) => {
                const job = jobById.get(c.jobId);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">
                      {c.payrollNumber}
                      {c.isFinalPayroll && <span className="ml-1 text-xs text-orange-700">FINAL</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {c.weekStarting} → {c.weekEnding}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {job ? (
                        <Link href={`/jobs/${job.id}`} className="text-yge-blue-500 hover:underline">
                          {job.projectName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">{c.jobId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {c.projectNumber ?? <span className="text-gray-400 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{c.rows.length}</td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${
                          c.status === 'ACCEPTED'
                            ? 'bg-green-100 text-green-800'
                            : c.status === 'SUBMITTED' || c.status === 'AMENDED'
                              ? 'bg-blue-100 text-blue-800'
                              : c.status === 'NON_PERFORMANCE'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {cprStatusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/certified-payrolls/${c.id}`} className="text-yge-blue-500 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
