// /bid-results — list of every bid result + lifetime rollup stats.
//
// Plain English: pursuit-intel database. Every agency-posted bid
// tabulation we've recorded, plus a running win-rate and competitor
// breakdown. The "competitors we run into most" list helps us figure
// out who's pricing what work — and how aggressively.

import Link from 'next/link';

import {
  AppShell,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import { getTranslator } from '../../lib/locale';
import {
  bidOutcomeLabel,
  computeBidResultRollup,
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
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { results: BidResult[] }).results;
  } catch { return []; }
}
async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs: Job[] }).jobs;
  } catch { return []; }
}

function outcomeTone(o: BidResult['outcome']): 'success' | 'danger' | 'warn' | 'muted' {
  switch (o) {
    case 'WON_BY_YGE': return 'success';
    case 'WON_BY_OTHER': return 'danger';
    case 'NO_AWARD': return 'muted';
    default: return 'warn';
  }
}

export default async function BidResultsPage() {
  const [results, jobs] = await Promise.all([fetchResults(), fetchJobs()]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const rollup = computeBidResultRollup(results);
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('bidResults.title')}
          subtitle={t('bidResults.subtitle')}
          actions={
            <LinkButton href="/bid-results/new" variant="primary" size="md">
              {t('bidResults.newResult')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('bidResults.tile.tracked')} value={rollup.bidsTracked} />
          <Tile
            label={t('bidResults.tile.winRate')}
            value={`${(rollup.winRate * 100).toFixed(1)}%`}
            sublabel={t('bidResults.tile.winRateSub', { wins: rollup.wins, losses: rollup.losses })}
            tone={rollup.winRate >= 0.25 ? 'success' : rollup.winRate >= 0.15 ? 'warn' : 'neutral'}
          />
          <Tile label={t('bidResults.tile.apparentLow')} value={rollup.apparentLowCount} sublabel={t('bidResults.tile.apparentLowSub')} />
          <Tile label={t('bidResults.tile.avgRank')} value={rollup.averageRank > 0 ? rollup.averageRank.toFixed(2) : '—'} />
        </section>

        {rollup.competitorAppearances.length > 0 ? (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900">{t('bidResults.competitors.heading')}</h2>
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white text-sm">
              {rollup.competitorAppearances.slice(0, 8).map((c) => (
                <li key={c.bidderName} className="flex items-center justify-between px-4 py-2">
                  <span className="font-medium text-gray-800">{c.bidderName}</span>
                  <span className="text-xs text-gray-600">
                    {t('bidResults.competitors.bidsCount', { count: c.appearances, plural: c.appearances === 1 ? '' : 's' })}
                    {c.wins > 0 ? <> · {t('bidResults.competitors.winsCount', { count: c.wins, plural: c.wins === 1 ? '' : 's' })}</> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold text-gray-900">{t('bidResults.recent.heading')}</h2>
          {results.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title={t('bidResults.empty.title')}
                body={t('bidResults.empty.body')}
                actions={[{ href: '/bid-results/new', label: t('bidResults.empty.action'), primary: true }]}
              />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2">{t('bidResults.col.bidDate')}</th>
                    <th className="px-4 py-2">{t('bidResults.col.job')}</th>
                    <th className="px-4 py-2">{t('bidResults.col.outcome')}</th>
                    <th className="px-4 py-2 text-right">{t('bidResults.col.ygeBid')}</th>
                    <th className="px-4 py-2 text-right">{t('bidResults.col.winningBid')}</th>
                    <th className="px-4 py-2">{t('bidResults.col.rank')}</th>
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
                      <tr key={r.id} className={r.outcome === 'WON_BY_YGE' ? 'bg-emerald-50' : ''}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          <Link href={`/bid-results/${r.id}`} className="text-blue-700 hover:underline">{r.bidOpenedAt}</Link>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {job ? (
                            <Link href={`/jobs/${job.id}`} className="text-blue-700 hover:underline">{job.projectName}</Link>
                          ) : (
                            <span className="text-gray-400">{r.jobId}</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusPill label={bidOutcomeLabel(r.outcome)} tone={outcomeTone(r.outcome)} /></td>
                        <td className="px-4 py-3 text-right">
                          {yge ? <Money cents={yge.amountCents} /> : <span className="font-mono text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {win !== undefined ? <Money cents={win} /> : <span className="font-mono text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {rank ?? <span className="text-gray-400">—</span>}
                          {delta !== undefined && delta > 0 ? (
                            <span className="ml-1 text-xs text-gray-500">
                              (+<Money cents={delta} />)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3"></td>
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
