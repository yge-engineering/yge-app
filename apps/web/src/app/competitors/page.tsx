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
import { getTranslator } from '../../lib/locale';

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

const WINDOWS: { key: WindowKey; labelKey: string; days: number | null }[] = [
  { key: 'all', labelKey: 'competitors.window.all', days: null },
  { key: '12m', labelKey: 'competitors.window.12m', days: 365 },
  { key: '6m', labelKey: 'competitors.window.6m', days: 183 },
  { key: '3m', labelKey: 'competitors.window.3m', days: 91 },
  { key: '1m', labelKey: 'competitors.window.1m', days: 30 },
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
  searchParams?: { window?: string; source?: string };
}

export default async function CompetitorsPage({ searchParams }: PageProps) {
  const allTabs = await fetchTabs();
  const window = parseWindow(searchParams?.window);
  const windowDef = WINDOWS.find((w) => w.key === window) ?? WINDOWS[0]!;
  const sourceFilter = searchParams?.source?.trim() || undefined;

  // Source counts computed against the WINDOWED set so the chip
  // numbers match the rollup the operator's about to read.
  const windowed = applyWindow(allTabs, windowDef.days);
  const sourceCounts = new Map<string, number>();
  for (const t of windowed) sourceCounts.set(t.source, (sourceCounts.get(t.source) ?? 0) + 1);

  const tabs = sourceFilter
    ? windowed.filter((t) => t.source === sourceFilter)
    : windowed;
  const { rollup, rows } = buildCompetitorProfilesFromTabs(tabs);
  const t = getTranslator();

  function chipHref(over: { window?: WindowKey; source?: string }): string {
    const params = new URLSearchParams();
    const nextWindow = over.window !== undefined ? over.window : window;
    const nextSource = over.source !== undefined ? over.source : sourceFilter;
    if (nextWindow && nextWindow !== 'all') params.set('window', nextWindow);
    if (nextSource) params.set('source', nextSource);
    const q = params.toString();
    return q ? `/competitors?${q}` : '/competitors';
  }

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
            title={t('competitors.title')}
            subtitle={t('competitors.subtitle')}
          />
          {rows.length > 0 && (
            <a
              href={`${publicApiBaseUrl()}/api/competitors?format=csv${
                windowDef.days ? `&days=${windowDef.days}` : ''
              }${sourceFilter ? `&source=${encodeURIComponent(sourceFilter)}` : ''}`}
              className="ml-4 mb-2 inline-flex shrink-0 items-center rounded-md border border-yge-blue-500 px-3 py-1.5 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              Download CSV
            </a>
          )}
        </div>

        <section className="mt-4 space-y-2 rounded-md border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-gray-500">{t('competitors.window.label')}</span>
            {WINDOWS.map((w) => {
              const active = w.key === window;
              return (
                <Link
                  key={w.key}
                  href={chipHref({ window: w.key })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    active
                      ? 'bg-yge-blue-500 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {t(w.labelKey)}
                </Link>
              );
            })}
            {window !== 'all' && (
              <span className="text-[11px] text-gray-500">
                {t('competitors.window.tabsInWindow', { tabs: tabs.length, total: allTabs.length })}
              </span>
            )}
          </div>
          {sourceCounts.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-gray-500">{t('bidtabs.filter.source')}</span>
              <Link
                href={chipHref({ source: '' })}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  !sourceFilter
                    ? 'bg-yge-blue-500 text-white'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t('bidtabs.filter.all')} ({windowed.length})
              </Link>
              {[...sourceCounts.entries()]
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .map(([source, count]) => {
                  const active = sourceFilter === source;
                  return (
                    <Link
                      key={source}
                      href={chipHref({ source })}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        active
                          ? 'bg-yge-blue-500 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {source} ({count})
                    </Link>
                  );
                })}
            </div>
          )}
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile label={t('competitors.tile.tabs')} value={String(rollup.tabsConsidered)} />
          <Tile label={t('competitors.tile.unique')} value={String(rollup.uniqueCompetitors)} />
          <Tile label={t('competitors.tile.appearances')} value={String(rollup.totalAppearances)} />
        </section>

        {rows.length === 0 ? (
          <p className="mt-6 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {t('competitors.empty')}{' '}
            <Link href="/bid-tabs" className="text-yge-blue-500 hover:underline">/bid-tabs</Link>
          </p>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t('competitors.col.competitor')}</th>
                  <th className="px-3 py-2 text-right">{t('competitors.col.tabs')}</th>
                  <th className="px-3 py-2 text-right">{t('competitors.col.apparentLow')}</th>
                  <th className="px-3 py-2 text-right">{t('competitors.col.awarded')}</th>
                  <th className="px-3 py-2 text-right">{t('competitors.col.avgBid')}</th>
                  <th className="px-3 py-2 text-right">{t('competitors.col.avgRank')}</th>
                  <th className="px-3 py-2 text-left">{t('competitors.col.topAgency')}</th>
                  <th className="px-3 py-2 text-left">{t('competitors.col.counties')}</th>
                  <th className="px-3 py-2 text-left">{t('competitors.col.active')}</th>
                  <th className="px-3 py-2 text-left">{t('competitors.col.flags')}</th>
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
