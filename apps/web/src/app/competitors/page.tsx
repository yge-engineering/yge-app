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

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
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

type WindowKey = 'all' | '12m' | '6m' | '3m' | '1m';

const WINDOWS: { key: WindowKey; label: string; days: number | null }[] = [
  { key: 'all', label: 'All time', days: null },
  { key: '12m', label: 'Last 12 mo', days: 365 },
  { key: '6m', label: 'Last 6 mo', days: 183 },
  { key: '3m', label: 'Last 3 mo', days: 91 },
  { key: '1m', label: 'Last 30 d', days: 30 },
];

function parseWindow(raw: string | undefined): WindowKey {
  if (raw === '12m' || raw === '6m' || raw === '3m' || raw === '1m') return raw;
  return 'all';
}

function applyWindow(tabs: BidTab[], days: number | null): BidTab[] {
  if (days === null) return tabs;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return tabs.filter((t) => {
    const day = t.bidOpenedAt.slice(0, 10);
    const ts = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

interface PageProps {
  searchParams?: { window?: string };
}

export default async function CompetitorsPage({ searchParams }: PageProps) {
  const allTabs = await fetchTabs();
  const window = parseWindow(searchParams?.window);
  const windowDef = WINDOWS.find((w) => w.key === window) ?? WINDOWS[0]!;
  const tabs = applyWindow(allTabs, windowDef.days);
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

        <div className="flex items-end justify-between">
          <PageHeader
            title="Competitors"
            subtitle="Local-market competitor profiles rolled up from the public bid-tab corpus. Read this before sizing a bid — who shows up, how often, at what dollar range."
          />
          {rows.length > 0 && (
            <a
              href={`${publicApiBaseUrl()}/api/competitors?format=csv${
                windowDef.days ? `&days=${windowDef.days}` : ''
              }`}
              className="ml-4 mb-2 inline-flex shrink-0 items-center rounded-md border border-yge-blue-500 px-3 py-1.5 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              Download CSV
            </a>
          )}
        </div>

        <section className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Window:</span>
          {WINDOWS.map((w) => {
            const active = w.key === window;
            const href = w.key === 'all' ? '/competitors' : `/competitors?window=${w.key}`;
            return (
              <Link
                key={w.key}
                href={href}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active
                    ? 'bg-yge-blue-500 text-white'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {w.label}
              </Link>
            );
          })}
          {window !== 'all' && (
            <span className="text-[11px] text-gray-500">
              {tabs.length} of {allTabs.length} tabs in window
            </span>
          )}
        </section>

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
