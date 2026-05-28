// /bid-results/competitor-detail?name=<bidderName>
//
// Per-competitor history page. Was a "coming soon" placeholder for
// months; this is the real thing.
//
// Plain English: given a competitor name (deep-linked from the
// top-competitors leaderboard rows), shows:
//   - Their total appearances + win count on YGE-bid tabs
//   - Head-to-head record vs YGE (their wins, our wins, median gap)
//   - Lifetime $ won across the bid tabs we tracked
//   - Most recent head-to-head encounters, newest first
//
// Server component. Fetches /api/bid-results once, runs everything
// through summarizeCompetitor in @yge/shared.
//
// Use cases:
//   - Ryan before a bid: "what's our record vs Ford?"
//   - Bid-no-bid coaching: "they show up 12x and win 9 — risky to chase"
//   - Brook to the bond agent: "our biggest losing competitor"

import Link from 'next/link';

import { AppShell, PageHeader } from '../../../components';
import { PrintButton } from '../../../components/print-button';
import { requirePermission } from '../../../lib/permissions';
import {
  summarizeCompetitor,
  type BidResult,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ListResponse { results?: BidResult[] }

async function fetchBidResults(): Promise<BidResult[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as ListResponse).results ?? [];
  } catch {
    return [];
  }
}

function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function signedFormatUsd(cents: number): string {
  if (cents === 0) return '$0';
  const sign = cents < 0 ? '-' : '+';
  return `${sign}${formatUsd(Math.abs(cents))}`;
}

export default async function CompetitorDetailPage({
  searchParams,
}: {
  searchParams: { name?: string };
}) {
  requirePermission('estimates:view');

  const name = (searchParams.name ?? '').trim();

  if (!name) {
    return (
      <AppShell>
        <main className="mx-auto max-w-3xl p-6 sm:p-8">
          <PageHeader
            title="Competitor detail"
            subtitle="Add a ?name= query parameter to see one competitor's record vs YGE."
          />
          <p className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
            From the{' '}
            <Link href="/bid-results/top-competitors" className="text-yge-blue-500 hover:underline">
              top competitors
            </Link>{' '}
            leaderboard, click any competitor name to land here with their
            name pre-filled.
          </p>
        </main>
      </AppShell>
    );
  }

  const results = await fetchBidResults();
  const summary = summarizeCompetitor(name, results);
  const ygeShare =
    summary.headToHeadCount === 0
      ? 0
      : Math.round((summary.headToHeadYgeWon / summary.headToHeadCount) * 100);
  const theirShare =
    summary.headToHeadCount === 0
      ? 0
      : Math.round((summary.headToHeadTheyWon / summary.headToHeadCount) * 100);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between text-sm">
          <Link
            href="/bid-results/top-competitors"
            className="text-yge-blue-500 hover:underline"
          >
            &larr; All top competitors
          </Link>
          <PrintButton label="Print" />
        </div>

        <PageHeader
          title={name}
          subtitle={
            summary.appearances === 0
              ? 'No bid tabs on file mention this contractor yet.'
              : `${summary.appearances} tab${summary.appearances === 1 ? '' : 's'} on file · last seen ${summary.lastSeenAt ?? '—'}`
          }
        />

        {summary.appearances === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-700">
            We haven&apos;t recorded any bid tabs with{' '}
            <strong>{name}</strong> on them. Try a different spelling — names
            are matched case-insensitively but spelling has to match.
          </p>
        ) : (
          <>
            {/* Top-line tiles. */}
            <section className="mt-6 grid gap-3 sm:grid-cols-4">
              <Tile label="Appearances" value={String(summary.appearances)} />
              <Tile
                label="Tabs they won"
                value={String(summary.wins)}
                tone="warn"
              />
              <Tile
                label="Head-to-head"
                value={String(summary.headToHeadCount)}
              />
              <Tile
                label="Lifetime $ won"
                value={formatUsd(summary.totalWonCents)}
              />
            </section>

            {/* Head-to-head split. */}
            {summary.headToHeadCount > 0 && (
              <section className="mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Head-to-head vs YGE
                </h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Cell label="YGE wins" value={`${summary.headToHeadYgeWon} (${ygeShare}%)`} tone="ready" />
                  <Cell label="Their wins" value={`${summary.headToHeadTheyWon} (${theirShare}%)`} tone="warn" />
                  <Cell
                    label="Median gap"
                    value={signedFormatUsd(summary.medianGapCents)}
                    hint={
                      summary.medianGapCents < 0
                        ? 'They are typically lower than YGE'
                        : summary.medianGapCents > 0
                          ? 'YGE is typically lower than them'
                          : 'Even split'
                    }
                  />
                </div>
              </section>
            )}

            {/* Recent head-to-head encounters. */}
            {summary.headToHead.length > 0 && (
              <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Recent head-to-head encounters
                </h2>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Bid date</th>
                      <th className="px-3 py-2 text-left">Job</th>
                      <th className="px-3 py-2 text-right">Their bid</th>
                      <th className="px-3 py-2 text-right">YGE bid</th>
                      <th className="px-3 py-2 text-right">Gap</th>
                      <th className="px-3 py-2 text-left">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summary.headToHead.slice(0, 25).map((h) => (
                      <tr key={h.bidResultId}>
                        <td className="px-3 py-2 font-mono text-xs">{h.bidOpenedAt}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href={`/bid-results/${h.bidResultId}`}
                            className="text-yge-blue-500 hover:underline"
                          >
                            {h.jobId}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatUsd(h.theirAmountCents)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          {formatUsd(h.ygeAmountCents)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono text-xs ${
                            h.gapCents < 0
                              ? 'text-amber-700'
                              : h.gapCents > 0
                                ? 'text-emerald-700'
                                : ''
                          }`}
                        >
                          {signedFormatUsd(h.gapCents)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {outcomeLabel(h.outcome)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.headToHead.length > 25 && (
                  <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                    Showing the 25 most recent of {summary.headToHead.length}.
                  </p>
                )}
              </section>
            )}

            {/* Stats sidebar / winning detail. */}
            {summary.wins > 0 && (
              <section className="mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Winning detail
                </h2>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                  <Row label="Biggest win" value={formatUsd(summary.biggestWinCents)} />
                  <Row label="Average win" value={formatUsd(summary.averageWinCents)} />
                </dl>
              </section>
            )}
          </>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Built from <code className="rounded bg-gray-100 px-1">/api/bid-results</code> + the
          {' '}<code className="rounded bg-gray-100 px-1">summarizeCompetitor</code> shared helper.
          Name matching is case-insensitive and collapses whitespace, but
          spelling has to match — the bid-result import flow is your
          canonical source.
        </p>
      </main>
    </AppShell>
  );
}

function outcomeLabel(o: BidResult['outcome']): string {
  switch (o) {
    case 'WON_BY_YGE': return 'YGE won';
    case 'WON_BY_OTHER': return 'They won';
    case 'NO_AWARD': return 'No award';
    case 'TBD': return 'Pending';
  }
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn' | 'ready';
}) {
  const valueCls =
    tone === 'warn'
      ? 'text-amber-700'
      : tone === 'ready'
        ? 'text-emerald-700'
        : 'text-gray-900';
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueCls}`}>{value}</div>
    </div>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'ready';
}) {
  const valueCls =
    tone === 'warn'
      ? 'text-amber-700'
      : tone === 'ready'
        ? 'text-emerald-700'
        : 'text-gray-900';
  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-0.5 text-base font-bold ${valueCls}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="font-mono text-xs text-gray-900">{value}</dd>
    </div>
  );
}
