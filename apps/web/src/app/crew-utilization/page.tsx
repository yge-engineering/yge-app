// /crew-utilization — per-employee billable vs overhead vs target hours.
//
// Plain English: are we billing all our crew time? A loaded operator
// sitting in the shop is pure overhead bleed. This page surfaces it
// by employee, with a top-line dollar number when we have rates.

import {
  AppShell,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  buildCrewUtilization,
  findRateInEffect,
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
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function flagTone(flag: CrewUtilizationFlag): 'success' | 'warn' | 'danger' | 'muted' {
  switch (flag) {
    case 'WELL_UTILIZED': return 'success';
    case 'UNDER_UTILIZED': return 'danger';
    case 'OVER_TARGET': return 'warn';
    case 'NO_TIMECARD': return 'muted';
  }
}

function flagLabel(flag: CrewUtilizationFlag): string {
  switch (flag) {
    case 'WELL_UTILIZED': return 'OK';
    case 'UNDER_UTILIZED': return 'Under';
    case 'OVER_TARGET': return 'Over';
    case 'NO_TIMECARD': return 'No card';
  }
}

function rowTint(flag: CrewUtilizationFlag): string {
  if (flag === 'UNDER_UTILIZED') return 'bg-red-50';
  if (flag === 'OVER_TARGET') return 'bg-amber-50';
  if (flag === 'NO_TIMECARD') return 'bg-gray-50 text-gray-500';
  return '';
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

  const overheadJobIds = new Set<string>();
  for (const j of jobs) {
    if (j.id.toLowerCase().startsWith('ovh-') || j.id.toLowerCase().startsWith('job-ovh')) {
      overheadJobIds.add(j.id);
    }
  }

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

  const blendedTone =
    rollup.blendedUtilization < 0.5 ? 'danger' : rollup.blendedUtilization < 0.75 ? 'warn' : 'success';

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <PageHeader
          title="Crew utilization"
          subtitle="Per-employee billable vs overhead vs target hours over the period. Worst utilization first. A loaded operator sitting in the shop is pure overhead bleed — this is where you spot it."
        />

        <form action="/crew-utilization" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Start</span>
            <input name="start" type="date" defaultValue={start} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">End</span>
            <input name="end" type="date" defaultValue={end} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-gray-700">Rate county</span>
            <input name="county" defaultValue={county} className="rounded border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <button type="submit" className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800">
            Reload
          </button>
        </form>

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Employees" value={rollup.employees} />
          <Tile
            label="Billable hours"
            value={rollup.totalBillableHours}
            sublabel={`of ${rollup.totalTargetHours} target`}
          />
          <Tile
            label="Overhead hours"
            value={rollup.totalOverheadHours}
            tone={rollup.totalOverheadHours > 0 ? 'warn' : 'success'}
            sublabel={
              rollup.totalOverheadCostCents != null
                ? `$${(rollup.totalOverheadCostCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} burdened`
                : undefined
            }
          />
          <Tile
            label="Blended utilization"
            value={`${(rollup.blendedUtilization * 100).toFixed(0)}%`}
            tone={blendedTone}
          />
        </section>

        {rows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
            No employees on the roster.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
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
                    <td className="px-3 py-2 font-medium text-gray-900">{r.employeeName}</td>
                    <td className="px-3 py-2 text-gray-600">{r.classificationLabel}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.actualHours}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.billableHours}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.overheadHours > 0 ? r.overheadHours : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">{r.targetHours}</td>
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
                    <td className="px-3 py-2 text-right">
                      {r.overheadCostCents != null && r.overheadCostCents > 0
                        ? <Money cents={r.overheadCostCents} />
                        : <span className="font-mono text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill label={flagLabel(r.flag)} tone={flagTone(r.flag)} />
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-black bg-gray-50 font-semibold">
                  <td className="px-3 py-3 uppercase tracking-wide" colSpan={2}>Totals</td>
                  <td className="px-3 py-3 text-right font-mono">{rollup.totalActualHours}</td>
                  <td className="px-3 py-3 text-right font-mono">{rollup.totalBillableHours}</td>
                  <td className="px-3 py-3 text-right font-mono">{rollup.totalOverheadHours}</td>
                  <td className="px-3 py-3 text-right font-mono">{rollup.totalTargetHours}</td>
                  <td className="px-3 py-3 text-right font-mono">{(rollup.blendedUtilization * 100).toFixed(0)}%</td>
                  <td className="px-3 py-3 text-right">
                    {rollup.totalOverheadCostCents != null
                      ? <Money cents={rollup.totalOverheadCostCents} />
                      : <span className="font-mono text-gray-400">—</span>}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 max-w-3xl text-xs text-gray-500">
          Target hours = (Mon-Fri days in the period) × 8. PTO and holidays are not yet first-class —
          Phase 2 payroll pulls those in. Overhead is any time card entry whose jobId starts with
          <code className="mx-1 rounded bg-gray-100 px-1 font-mono">ovh-</code> or is on a job marked
          overhead. Dollar weight uses the DIR base rate for the employee's classification in the
          chosen county.
        </p>
      </main>
    </AppShell>
  );
}
