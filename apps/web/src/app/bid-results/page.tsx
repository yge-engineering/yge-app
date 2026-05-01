// /bid-results — list of every bid result + lifetime rollup stats.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  bidOutcomeLabel,
  computeBidResultRollup,
  formatUSD,
  winningAmountCents,
  ygeBid,
  ygeDeltaToWinnerCents,
  ygeRank,
  type BidResult,
  type Job,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchResults(): Promise<BidResult[]> {
  const res = await fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { results: BidResult[] }).results;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}

export default async function BidResultsPage() {
  const [results, jobs] = await Promise.all([fetchResults(), fetchJobs()]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeBidResultRollup(results);

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/bid-results/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New result
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Bid results</h1>
      <p className="mt-2 text-gray-700">
        Pursuit-intel database. Every agency-posted bid tabulation we&rsquo;ve
        recorded, plus a running win-rate and competitor breakdown.
      </p>

      {/* Rollup stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Bids tracked" value={rollup.bidsTracked} />
        <Stat
          label="Win rate"
          value={`${(rollup.winRate * 100).toFixed(1)}%`}
          subtitle={`${rollup.wins}W / ${rollup.losses}L`}
        />
        <Stat
          label="Apparent low"
          value={rollup.apparentLowCount}
          subtitle="Lowest bid on tab"
        />
        <Stat
          label="Avg rank"
          value={rollup.averageRank > 0 ? rollup.averageRank.toFixed(2) : '—'}
        />
      </section>

      {rollup.competitorAppearances.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Competitors we run into most
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
            {rollup.competitorAppearances.slice(0, 8).map((c) => (
              <li
                key={c.bidderName}
                className="flex items-center justify-between px-4 py-2"
              >
                <span className="font-medium text-gray-800">{c.bidderName}</span>
                <span className="text-xs text-gray-600">
                  {c.appearances} bid{c.appearances === 1 ? '' : 's'}
                  {c.wins > 0 && (
                    <>
                      {' '}&middot; {c.wins} win{c.wins === 1 ? '' : 's'}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Recent results</h2>
        {results.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No results recorded yet. Click <em>New result</em> to log one.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Bid date</th>
                  <th className="px-4 py-2">Job</th>
                  <th className="px-4 py-2">Outcome</th>
                  <th className="px-4 py-2">YGE bid</th>
                  <th className="px-4 py-2">Winning bid</th>
                  <th className="px-4 py-2">Rank</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r) => {
                  const yge = ygeBid(r);
                  const win = winningAmountCents(r);
                  const rank = ygeRank(r);
                  const delta = ygeDeltaToWinnerCents(r);
                  const job = jobById.get(r.jobId);
                  return (
                    <tr key={r.id} className={r.outcome === 'WON_BY_YGE' ? 'bg-green-50' : ''}>
                      <td className="px-4 py-3 text-gray-900">{r.bidOpenedAt}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {job ? (
                          <Link
                            href={`/jobs/${job.id}`}
                            className="text-yge-blue-500 hover:underline"
                          >
                            {job.projectName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">{r.jobId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <OutcomePill outcome={r.outcome} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {yge ? formatUSD(yge.amountCents) : <span className="text-gray-400">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {win !== undefined ? formatUSD(win) : <span className="text-gray-400">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {rank ?? <span className="text-gray-400">&mdash;</span>}
                        {delta !== undefined && delta > 0 && (
                          <span className="ml-1 text-xs text-gray-500">
                            (+{formatUSD(delta)})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/bid-results/${r.id}`}
                          className="text-yge-blue-500 hover:underline"
                        >
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
      </section>
    </main>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-yge-blue-500">{value}</div>
      {subtitle && <div className="text-xs text-gray-600">{subtitle}</div>}
    </div>
  );
}

function OutcomePill({ outcome }: { outcome: BidResult['outcome'] }) {
  const cls =
    outcome === 'WON_BY_YGE'
      ? 'bg-green-100 text-green-800'
      : outcome === 'WON_BY_OTHER'
        ? 'bg-red-100 text-red-800'
        : outcome === 'NO_AWARD'
          ? 'bg-gray-100 text-gray-700'
          : 'bg-yellow-100 text-yellow-800';
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-semibold uppercase tracking-wide ${cls}`}>
      {bidOutcomeLabel(outcome)}
    </span>
  );
}
