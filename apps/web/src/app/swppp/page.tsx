// /swppp — SWPPP / BMP inspection log.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  computeSwpppRollup,
  deficiencyCount,
  openDeficiencyCount,
  swpppTriggerLabel,
  type SwpppInspection,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInspections(filter: { jobId?: string }): Promise<SwpppInspection[]> {
  const url = new URL(`${apiBaseUrl()}/api/swppp-inspections`);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { inspections: SwpppInspection[] }).inspections;
}

export default async function SwpppPage({
  searchParams,
}: {
  searchParams: { jobId?: string };
}) {
  const inspections = await fetchInspections(searchParams);
  const rollup = computeSwpppRollup(inspections);

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/swppp/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New inspection
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">SWPPP Inspections</h1>
      <p className="mt-2 text-gray-700">
        Stormwater Pollution Prevention Plan / BMP inspections per the CA
        Construction General Permit. Audited by State Water Resources Control
        Board.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat
          label="With deficiencies"
          value={rollup.withDeficiencies}
          variant={rollup.withDeficiencies > 0 ? 'warn' : 'ok'}
        />
        <Stat
          label="Open deficiencies"
          value={rollup.openDeficiencies}
          variant={rollup.openDeficiencies > 0 ? 'bad' : 'ok'}
        />
        <Stat
          label="Days since last"
          value={rollup.daysSinceLast ?? '—'}
          variant={rollup.weeklyCadenceLate ? 'bad' : 'ok'}
        />
      </section>

      {rollup.weeklyCadenceLate && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>Weekly cadence missed:</strong> {rollup.daysSinceLast} days since
          last inspection ({rollup.lastInspectedOn}). The CGP requires at least
          weekly inspections during the rainy season.
        </div>
      )}

      {inspections.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No SWPPP inspections yet. Click <em>New inspection</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Trigger</th>
                <th className="px-4 py-2">Inspector</th>
                <th className="px-4 py-2">Job</th>
                <th className="px-4 py-2 text-right">BMPs</th>
                <th className="px-4 py-2 text-right">Deficient</th>
                <th className="px-4 py-2 text-right">Open</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inspections.map((s) => {
                const def = deficiencyCount(s);
                const open = openDeficiencyCount(s);
                return (
                  <tr key={s.id} className={open > 0 ? 'bg-red-50' : def > 0 ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 text-xs text-gray-700">{s.inspectedOn}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {swpppTriggerLabel(s.trigger)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {s.inspectorName}
                      {s.inspectorCertification && (
                        <div className="text-[10px] text-gray-500">
                          QSP/QSD #{s.inspectorCertification}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {s.jobId}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {s.bmpChecks.length}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {def > 0 ? (
                        <span className="text-yellow-800 font-semibold">{def}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {open > 0 ? (
                        <span className="text-red-800 font-semibold">{open}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/swppp/${s.id}`} className="text-yge-blue-500 hover:underline">
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
    </AppShell>
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
