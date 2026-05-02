// /competitors — local-market competitor profiles rolled up from
// the public bid-tab corpus.
//
// Reads BidTab[] from /api/bid-tabs and runs buildCompetitorProfilesFromTabs
// on the raw rows. Surface area:
//   - Tiles: tabs considered, unique competitors, total appearances
//   - Table: appearances · apparent-low · awards · avg bid · avg
//     rank · top agencies · top counties · DBE/SBE flags · date
//     range
//
// The estimator reads this page before sizing a bid: who shows up,
// how often, where, at what dollar range.

import Link from 'next/link';
import { AppShell, PageHeader, StatusPill } from '../../components';
import {
  buildCompetitorProfilesFromTabs,
  type BidTab,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTabs(): Promise<BidTab[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bid-tabs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { tabs: BidTab[] }).tabs;
  } catch { return []; }
}

function formatMoney(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function CompetitorsPage() {
  const tabs = await fetchTabs();
  const { rollup, rows } = buildCompetitorProfilesFromTabs(tabs);

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <Link href="/bid-tabs" className="text-sm text-yge-blue-500 hover:underline">
            Bid tabs &rarr;
          </Link>
        </div>

        <PageHeader
          title="Competitors"
          subtitle="Local-market competitor profiles rolled up from the public bid-tab corpus. Read this before sizing a bid — who shows up, how often, at what dollar range."
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label="Bid tabs considered" value={String(rollup.tabsConsidered)} />
          <Tile label="Unique competitors" value={String(rollup.uniqueCompetitors)} />
          <Tile label="Total appearances" value={String(rollup.totalAppearances)} />
        </section>

        {rows.length === 0 ? (
          <p className="mt-6 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            No competitor data yet. Import a bid tab on{' '}
            <Link href="/bid-tabs" className="text-yge-blue-500 hover:underline">/bid-tabs</Link>{' '}
            and the rollup will populate.
          </p>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Competitor</th>
                  <th className="px-3 py-2 text-right">Tabs</th>
                  <th className="px-3 py-2 text-right">Apparent low</th>
                  <th className="px-3 py-2 text-right">Awarded</th>
                  <th className="px-3 py-2 text-right">Avg bid</th>
                  <th className="px-3 py-2 text-right">Avg rank</th>
                  <th className="px-3 py-2 text-left">Top agency</th>
                  <th className="px-3 py-2 text-left">Counties</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  <th className="px-3 py-2 text-left">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const lowRate = r.appearances > 0 ? r.apparentLowCount / r.appearances : 0;
                  const counties = r.topCounties.slice(0, 3).map((c) => c.county).join(', ');
                  const topAgency = r.topAgencies[0];
                  return (
                    <tr key={r.nameNormalized}>
                      <td className="px-3 py-2 align-top">
                        <Link
                          href={`/competitors/${encodeURIComponent(r.nameNormalized)}`}
                          className="font-medium text-yge-blue-500 hover:underline"
                        >
                          {r.displayName}
                        </Link>
                        <div className="font-mono text-[10px] text-gray-500">
                          {r.cslbLicense ? `CSLB ${r.cslbLicense}` : ''}
                          {r.dirRegistration ? ` · DIR ${r.dirRegistration}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right font-mono">{r.appearances}</td>
                      <td className="px-3 py-2 align-top text-right font-mono">
                        {r.apparentLowCount}
                        <div className="text-[10px] text-gray-500">
                          {(lowRate * 100).toFixed(0)}%
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right font-mono">{r.awardCount}</td>
                      <td className="px-3 py-2 align-top text-right font-mono">
                        {formatMoney(r.avgBidCents)}
                      </td>
                      <td className="px-3 py-2 align-top text-right font-mono">
                        {r.avgRank.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-700">
                        {topAgency?.agencyName ?? '—'}
                        {topAgency && (
                          <div className="text-[10px] text-gray-500">×{topAgency.count}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-gray-700">
                        {counties || '—'}
                      </td>
                      <td className="px-3 py-2 align-top font-mono text-[11px] text-gray-700">
                        {r.firstSeenAt}
                        <div className="text-[10px] text-gray-500">→ {r.lastSeenAt}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {r.everDbe && <StatusPill label="DBE" tone="info" size="sm" />}
                        {r.everSbe && <StatusPill label="SBE" tone="info" size="sm" />}
                        {r.everWithdrawn && <StatusPill label="W" tone="warn" size="sm" />}
                        {r.everRejected && <StatusPill label="R" tone="danger" size="sm" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <p className="mt-6 text-xs text-gray-500">
          The rollup is recomputed on each render against the current
          /api/bid-tabs corpus — no persistence layer to refresh. To
          surface a new competitor, import the bid tab they appeared on.
          Per-competitor detail pages (head-to-head with YGE, agency
          win-rate breakdowns) layer on top later.
        </p>
      </main>
    </AppShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
