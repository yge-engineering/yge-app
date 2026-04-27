// /mileage — mileage log list view.

import Link from 'next/link';
import {
  computeMileageRollup,
  formatUSD,
  mileagePurposeLabel,
  reimbursementCents,
  type MileageEntry,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchEntries(filter: {
  employeeId?: string;
  reimbursed?: string;
}): Promise<MileageEntry[]> {
  const url = new URL(`${apiBaseUrl()}/api/mileage`);
  if (filter.employeeId) url.searchParams.set('employeeId', filter.employeeId);
  if (filter.reimbursed) url.searchParams.set('reimbursed', filter.reimbursed);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { entries: MileageEntry[] }).entries;
}
async function fetchAll(): Promise<MileageEntry[]> {
  const res = await fetch(`${apiBaseUrl()}/api/mileage`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { entries: MileageEntry[] }).entries;
}

export default async function MileagePage({
  searchParams,
}: {
  searchParams: { employeeId?: string; reimbursed?: string };
}) {
  const [entries, all] = await Promise.all([fetchEntries(searchParams), fetchAll()]);
  const rollup = computeMileageRollup(all);

  function buildHref(overrides: Partial<{ reimbursed?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.employeeId) params.set('employeeId', merged.employeeId);
    if (merged.reimbursed) params.set('reimbursed', merged.reimbursed);
    const q = params.toString();
    return q ? `/mileage?${q}` : '/mileage';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${publicApiBaseUrl()}/api/mileage?format=csv${searchParams.employeeId ? '&employeeId=' + encodeURIComponent(searchParams.employeeId) : ''}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Download CSV
          </a>
          <Link
            href="/mileage/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + Log mileage
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Mileage Log</h1>
      <p className="mt-2 text-gray-700">
        Per-employee odometer / mileage entries. Personal-vehicle miles flow
        into IRS-rate reimbursement; company-vehicle miles back equipment
        depreciation + per-diem proof.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Entries" value={rollup.total} />
        <Stat label="Total miles" value={rollup.totalBusinessMiles.toFixed(1)} />
        <Stat label="Personal-vehicle miles" value={rollup.personalMiles.toFixed(1)} />
        <Stat
          label="Reimburse owed"
          value={formatUSD(rollup.outstandingCents)}
          variant={rollup.outstandingCents > 0 ? 'warn' : 'ok'}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Reimbursed:</span>
        <Link
          href={buildHref({ reimbursed: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.reimbursed ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        <Link
          href={buildHref({ reimbursed: 'false' })}
          className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'false' ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          Owed
        </Link>
        <Link
          href={buildHref({ reimbursed: 'true' })}
          className={`rounded px-2 py-1 text-xs ${searchParams.reimbursed === 'true' ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          Paid
        </Link>
      </section>

      {entries.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No mileage entries in this filter. Click <em>Log mileage</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Vehicle</th>
                <th className="px-4 py-2">Purpose</th>
                <th className="px-4 py-2 text-right">Miles</th>
                <th className="px-4 py-2 text-right">Reimburse</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => {
                const reimb = reimbursementCents(e);
                return (
                  <tr key={e.id} className={!e.reimbursed && reimb > 0 ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {e.tripDate}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{e.employeeName}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {e.vehicleDescription}
                      {e.isPersonalVehicle && (
                        <div className="mt-0.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                          Personal
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {mileagePurposeLabel(e.purpose)}
                      {e.jobId && (
                        <div className="text-[10px] font-mono text-gray-500">{e.jobId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {e.businessMiles.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {reimb > 0 ? formatUSD(reimb) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {e.reimbursed ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold text-green-800">
                          Paid
                        </span>
                      ) : reimb > 0 ? (
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-semibold text-yellow-800">
                          Owed
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/mileage/${e.id}`} className="text-yge-blue-500 hover:underline">
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
