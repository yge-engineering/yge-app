// /bid-tabs — public bid-tabulation corpus.
//
// The dataset estimates lean on for "what did the rest of the
// market bid?". Every row here is a public-works bid open the
// scrapers (or the manual-import form below) lifted off an agency
// portal. Two reads:
//   - Browse + search by agency / county / project name
//   - Open one tab to see ranked bidders + apparent low + delta to
//     engineers' estimate

import Link from 'next/link';
import { AppShell, PageHeader, StatusPill } from '../../components';
import { BidTabImportForm } from '../../components/bid-tab-import-form';
import { getTranslator } from '../../lib/locale';
import type { BidTab } from '@yge/shared';

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
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

interface BidTabsPageProps {
  searchParams?: { source?: string; county?: string };
}

export default async function BidTabsPage({ searchParams }: BidTabsPageProps) {
  const allTabs = await fetchTabs();

  // Per-source + per-county counts for the chip rows. Computed
  // on the unfiltered set so the operator sees how many tabs
  // each chip would surface.
  const bySource = new Map<string, number>();
  const byCounty = new Map<string, number>();
  for (const t of allTabs) {
    bySource.set(t.source, (bySource.get(t.source) ?? 0) + 1);
    if (t.county) byCounty.set(t.county, (byCounty.get(t.county) ?? 0) + 1);
  }
  const sourceFilter = searchParams?.source?.trim() || undefined;
  const countyFilter = searchParams?.county?.trim() || undefined;

  const tabs = allTabs.filter((t) => {
    if (sourceFilter && t.source !== sourceFilter) return false;
    if (countyFilter && t.county !== countyFilter) return false;
    return true;
  });

  const totalBidders = tabs.reduce((acc, t) => acc + t.bidders.length, 0);

  function chipHref(over: { source?: string; county?: string }): string {
    const params = new URLSearchParams();
    const merged = {
      source: over.source !== undefined ? over.source : sourceFilter,
      county: over.county !== undefined ? over.county : countyFilter,
    };
    if (merged.source) params.set('source', merged.source);
    if (merged.county) params.set('county', merged.county);
    const q = params.toString();
    return q ? `/bid-tabs?${q}` : '/bid-tabs';
  }

  const topCounties = [...byCounty.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);

  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <Link href="/bid-results" className="text-sm text-yge-blue-500 hover:underline">
            YGE bid results &rarr;
          </Link>
        </div>

        <div className="flex items-end justify-between">
          <PageHeader
            title={t('bidtabs.title')}
            subtitle={t('bidtabs.subtitle')}
          />
          {tabs.length > 0 && (
            <a
              href={`${publicApiBaseUrl()}/api/bid-tabs?format=csv${
                sourceFilter ? `&source=${encodeURIComponent(sourceFilter)}` : ''
              }${countyFilter ? `&county=${encodeURIComponent(countyFilter)}` : ''}`}
              className="ml-4 mb-2 inline-flex shrink-0 items-center rounded-md border border-yge-blue-500 px-3 py-1.5 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            >
              Download CSV
            </a>
          )}
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Tile label={t('bidtabs.tile.imported')} value={String(tabs.length)} />
          <Tile label={t('bidtabs.tile.bidders')} value={String(totalBidders)} />
          <Tile label={t('bidtabs.tile.sources')} value={String(bySource.size)} />
        </section>

        {(bySource.size > 0 || byCounty.size > 0) && (
          <section className="mt-4 space-y-2 rounded-md border border-gray-200 bg-white p-3">
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
                {t('bidtabs.filter.all')} ({allTabs.length})
              </Link>
              {[...bySource.entries()]
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
            {topCounties.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">{t('bidtabs.filter.county')}</span>
                <Link
                  href={chipHref({ county: '' })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    !countyFilter
                      ? 'bg-yge-blue-500 text-white'
                      : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {t('bidtabs.filter.all')}
                </Link>
                {topCounties.map(([county, count]) => {
                  const active = countyFilter === county;
                  return (
                    <Link
                      key={county}
                      href={chipHref({ county })}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        active
                          ? 'bg-yge-blue-500 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {county} ({count})
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tabs.length === 0 ? (
          <p className="mt-6 rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {sourceFilter || countyFilter ? (
              <>
                {t('bidtabs.empty.no_match')}{' '}
                <Link href="/bid-tabs" className="text-yge-blue-500 hover:underline">
                  {t('bidtabs.empty.clearFilter')} →
                </Link>
              </>
            ) : (
              t('bidtabs.empty.no_tabs')
            )}
          </p>
        ) : (
          <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t('bidtabs.col.project')}</th>
                  <th className="px-3 py-2 text-left">{t('bidtabs.col.agency')}</th>
                  <th className="px-3 py-2 text-left">{t('bidtabs.col.source')}</th>
                  <th className="px-3 py-2 text-left">{t('bidtabs.col.opened')}</th>
                  <th className="px-3 py-2 text-right">{t('bidtabs.col.bidders')}</th>
                  <th className="px-3 py-2 text-right">{t('bidtabs.col.apparentLow')}</th>
                  <th className="px-3 py-2 text-right">{t('bidtabs.col.vsEE')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tabs.map((t) => {
                  const apparent = t.bidders.find((b) => b.rank === 1);
                  const ee = t.engineersEstimateCents;
                  const overshoot =
                    apparent && ee ? ((apparent.totalCents - ee) / ee) * 100 : null;
                  return (
                    <tr key={t.id}>
                      <td className="px-3 py-2 align-top">
                        <Link
                          href={`/bid-tabs/${t.id}`}
                          className="font-medium text-yge-blue-500 hover:underline"
                        >
                          {t.projectName}
                        </Link>
                        {t.projectNumber && (
                          <div className="font-mono text-[11px] text-gray-500">
                            {t.projectNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-700">
                        {t.agencyName}
                        {t.county && (
                          <div className="text-[11px] text-gray-500">
                            {t.county} County
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusPill label={t.source} tone="info" size="sm" />
                      </td>
                      <td className="px-3 py-2 align-top font-mono text-xs text-gray-700">
                        {t.bidOpenedAt.slice(0, 10)}
                      </td>
                      <td className="px-3 py-2 align-top text-right font-mono">
                        {t.bidders.length}
                      </td>
                      <td className="px-3 py-2 align-top text-right font-mono">
                        {apparent ? formatMoney(apparent.totalCents) : '—'}
                        {apparent && (
                          <div className="text-[10px] text-gray-500 line-clamp-1">
                            {apparent.name}
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2 align-top text-right font-mono ${
                          overshoot === null
                            ? 'text-gray-400'
                            : overshoot > 5
                              ? 'text-red-700'
                              : overshoot < -5
                                ? 'text-emerald-700'
                                : 'text-gray-700'
                        }`}
                      >
                        {overshoot === null ? '—' : `${overshoot >= 0 ? '+' : ''}${overshoot.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
            {t('bidtabs.manualImport')}
          </h2>
          <BidTabImportForm apiBaseUrl={publicApiBaseUrl()} />
        </section>
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
