// /dir-rates — DIR prevailing wage rate library.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  classificationLabel,
  computeDirRateRollup,
  formatUSD,
  totalFringeCents,
  totalPrevailingWageCents,
  type DirRate,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchRates(filter: { classification?: string; county?: string }): Promise<DirRate[]> {
  const url = new URL(`${apiBaseUrl()}/api/dir-rates`);
  if (filter.classification) url.searchParams.set('classification', filter.classification);
  if (filter.county) url.searchParams.set('county', filter.county);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { rates: DirRate[] }).rates;
}

export default async function DirRatesPage({
  searchParams,
}: {
  searchParams: { classification?: string; county?: string };
}) {
  const rates = await fetchRates(searchParams);
  const rollup = computeDirRateRollup(rates);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${publicApiBaseUrl()}/api/dir-rates?format=csv${searchParams.classification ? '&classification=' + encodeURIComponent(searchParams.classification) : ''}${searchParams.county ? '&county=' + encodeURIComponent(searchParams.county) : ''}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Download CSV
          </a>
          <Link
            href="/dir-rates/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + New rate
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">DIR Prevailing Wage</h1>
      <p className="mt-2 text-gray-700">
        California Department of Industrial Relations general prevailing wage
        determinations. Drives certified payroll and labor billing rates on
        public-works contracts.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Determinations" value={rollup.total} />
        <Stat label="Classifications" value={rollup.classifications} />
        <Stat label="Counties" value={rollup.counties} />
        <Stat
          label="Active today"
          value={rollup.activeToday}
          variant={rollup.activeToday > 0 ? 'ok' : 'warn'}
        />
      </section>

      {rates.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No DIR rates loaded yet. Click <em>New rate</em> to add a determination
          from{' '}
          <a
            href="https://www.dir.ca.gov/oprl/PWD/index.htm"
            className="text-yge-blue-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            DIR's website
          </a>
          .
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Classification</th>
                <th className="px-3 py-2">County</th>
                <th className="px-3 py-2">Effective</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2 text-right">Basic</th>
                <th className="px-3 py-2 text-right">Fringe</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.map((r) => {
                const isActive =
                  r.effectiveDate <= today &&
                  (!r.expiresOn || r.expiresOn >= today);
                return (
                  <tr key={r.id} className={isActive ? '' : 'bg-gray-50 text-gray-500'}>
                    <td className="px-3 py-2">
                      {classificationLabel(r.classification)}
                    </td>
                    <td className="px-3 py-2">{r.county}</td>
                    <td className="px-3 py-2 font-mono">{r.effectiveDate}</td>
                    <td className="px-3 py-2 font-mono">{r.expiresOn ?? 'current'}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(r.basicHourlyCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatUSD(totalFringeCents(r))}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {formatUSD(totalPrevailingWageCents(r))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/dir-rates/${r.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Edit
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
