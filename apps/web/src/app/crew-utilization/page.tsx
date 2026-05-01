// /crew-utilization — per-employee billable vs overhead vs target hours.
//
// Plain English: are we billing all our crew time? A loaded operator
// sitting in the shop is pure overhead bleed. This page surfaces it
// by employee, with a top-line dollar number when we have rates.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  buildCrewUtilization,
  findRateInEffect,
  formatUSD,
  type CrewUtilizationFlag,
  type DirClassification,
  type DirRate,
  type Employee,
  type Job,
  type TimeCard,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const body = (await res.json()) as Record<string, unknown>;
  const arr = body[key];
  return Array.isArray(arr) ? (arr as T[]) : [];
}

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  // Last day of current month
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

export default async function CrewUtilizationPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string; county?: string };
}) {
  const def = defaultPeriod();
  const start = searchParams.start?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? def.start;
  const end = searchParams.end?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? def.end;
  const county = searchParams.county?.trim() || 'Shasta';

  const [employees, timeCards, jobs, dirRates] = await Promise.all([
    fetchJson<Employee>('/api/employees', 'employees'),
    fetchJson<TimeCard>('/api/time-cards', 'cards'),
    fetchJson<Job>('/api/jobs', 'jobs'),
    fetchJson<DirRate>('/api/dir-rates', 'rates'),
  ]);

  // Anything tagged as overhead in the job record gets bucketed there.
  // Otherwise everything is billable. Phase 1 heuristic: jobId starts
  // with "ovh" or job.kind is OVERHEAD when that field exists.
  const overheadJobIds = new Set<string>();
  for (const j of jobs) {
    if (j.id.toLowerCase().startsWith('ovh-') || j.id.toLowerCase().startsWith('job-ovh')) {
      overheadJobIds.add(j.id);
    }
  }

  // Build classification → rate map for the dollar weight.
  const laborRatesByClassification = new Map<string, number>();
  const classifications = new Set<DirClassification>(
    employees.map((e) => e.classification),
  );
  for (const c of classifications) {
    const rate = findRateInEffect(dirRates, { classification: c, county, asOf: end });
    if (rate) laborRatesByClassification.set(c, rate.basicHourlyCents);
  }

  const { rows, rollup } = buildCrewUtilization({
    start,
    end,
    employees,
    timeCards,
    overheadJobIds,
    laborRatesByClassification,
  });

  return (
    <AppShell>
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Crew Utilization</h1>
      <p className="mt-2 max-w-3xl text-gray-700">
        Per-employee billable vs overhead vs target hours over the period.
        Worst utilization first. A loaded operator sitting in the shop is
        pure overhead bleed — this is where you spot it.
      </p>

      <form
        action="/crew-utilization"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      >
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Start</span>
          <input
            name="start"
            type="date"
            defaultValue={start}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">End</span>
          <input
            name="end"
            type="date"
            defaultValue={end}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-gray-700">Rate county</span>
          <input
            name="county"
            defaultValue={county}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          Reload
        </button>
      </form>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Employees" value={String(rollup.employees)} />
        <Stat
          label="Billable hours"
          value={`${rollup.totalBillableHours}`}
          sub={`of ${rollup.totalTargetHours} target`}
        />
        <Stat
          label="Overhead hours"
          value={`${rollup.totalOverheadHours}`}
          variant={rollup.totalOverheadHours > 0 ? 'warn' : 'ok'}
          sub={
            rollup.totalOverheadCostCents != null
              ? formatUSD(rollup.totalOverheadCostCents) + ' burdened'
              : undefined
          }
        />
        <Stat
          label="Blended utilization"
          value={`${(rollup.blendedUtilization * 100).toFixed(0)}%`}
          variant={
            rollup.blendedUtilization < 0.5
              ? 'bad'
              : rollup.blendedUtilization < 0.75
                ? 'warn'
                : 'ok'
          }
        />
      </section>

      {rows.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No employees on the roster.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Classification</th>
                <th className="px-3 py-2 text-right">Actual hr</th>
                <th className="px-3 py-2 text-right">Billable</th>
                <th className="px-3 py-2 text-right">Overhead</th>
                <th className="px-3 py-2 text-right">Target</th>
                <th className="px-3 py-2 text-right">Util %</th>
                <th className="px-3 py-2 text-right">Overhead $</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.employeeId} className={rowTint(r.flag)}>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {r.employeeName}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.classificationLabel}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.actualHours}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.billableHours}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.overheadHours > 0 ? r.overheadHours : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-500">
                    {r.targetHours}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      r.utilization < 0.5
                        ? 'font-bold text-red-700'
                        : r.utilization < 0.75
                          ? 'text-amber-700'
                          : ''
                    }`}
                  >
                    {(r.utilization * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.overheadCostCents != null && r.overheadCostCents > 0
                      ? formatUSD(r.overheadCostCents)
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <FlagBadge flag={r.flag} />
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                <td className="px-3 py-3 uppercase tracking-wide" colSpan={2}>
                  Totals
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {rollup.totalActualHours}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {rollup.totalBillableHours}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {rollup.totalOverheadHours}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {rollup.totalTargetHours}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {(rollup.blendedUtilization * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {rollup.totalOverheadCostCents != null
                    ? formatUSD(rollup.totalOverheadCostCents)
                    : '—'}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-3xl text-xs text-gray-500">
        Target hours = (Mon-Fri days in the period) × 8. PTO and holidays
        are not yet first-class — Phase 2 payroll pulls those in. Overhead
        is any time card entry whose jobId starts with <code>ovh-</code> or
        is on a job marked overhead. Dollar weight uses the DIR base rate
        for the employee&rsquo;s classification in the chosen county.
      </p>
    </main>
    </AppShell>
  );
}

function rowTint(flag: CrewUtilizationFlag): string {
  if (flag === 'UNDER_UTILIZED') return 'bg-red-50';
  if (flag === 'OVER_TARGET') return 'bg-amber-50';
  if (flag === 'NO_TIMECARD') return 'bg-gray-50 text-gray-500';
  return '';
}

function FlagBadge({ flag }: { flag: CrewUtilizationFlag }) {
  const styles: Record<CrewUtilizationFlag, string> = {
    UNDER_UTILIZED: 'bg-red-100 text-red-800',
    OVER_TARGET: 'bg-amber-100 text-amber-800',
    NO_TIMECARD: 'bg-gray-100 text-gray-600',
    WELL_UTILIZED: 'bg-green-100 text-green-800',
  };
  const label: Record<CrewUtilizationFlag, string> = {
    UNDER_UTILIZED: 'Under',
    OVER_TARGET: 'Over',
    NO_TIMECARD: 'No card',
    WELL_UTILIZED: 'OK',
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[flag]}`}
    >
      {label[flag]}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  variant = 'ok',
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: 'ok' | 'warn' | 'bad';
}) {
  const valueClass =
    variant === 'bad'
      ? 'text-red-700'
      : variant === 'warn'
        ? 'text-amber-700'
        : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</div>
      {sub != null && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
