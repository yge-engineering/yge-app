// Server component — surfaces the competitors who typically bid the
// agency a given job is for. Fetched at render time from the
// public bid-tab corpus. Empty state hints to /bid-tabs when there's
// no overlap yet.

import Link from 'next/link';
import { buildCompetitorProfilesFromTabs, type BidTab } from '@yge/shared';
import { getTranslator } from '../lib/locale';

interface Props {
  apiBaseUrl: string;
  ownerAgency: string;
  /** Limit the competitor list. Default 6. */
  topN?: number;
}

async function fetchTabsForAgency(apiBaseUrl: string, agency: string): Promise<BidTab[]> {
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/bid-tabs?search=${encodeURIComponent(agency)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    const all = ((await res.json()) as { tabs: BidTab[] }).tabs;
    // The /api/bid-tabs search query matches across multiple fields.
    // Tighten to exact agency match here so the panel only shows
    // history for THIS agency rather than every project that mentions
    // the substring elsewhere.
    const target = agency.trim().toLowerCase();
    return all.filter((t) => t.agencyName.toLowerCase() === target);
  } catch { return []; }
}

function formatMoney(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export async function JobAgencyCompetitors({ apiBaseUrl, ownerAgency, topN = 6 }: Props) {
  const tabs = await fetchTabsForAgency(apiBaseUrl, ownerAgency);
  const t = getTranslator();
  if (tabs.length === 0) {
    // Empty-state has an inline /bid-tabs link — split-and-fill via __LINK__.
    const emptyTpl = t('jobAgencyCompetitors.empty', { link: '__LINK__' });
    const [emptyPre, emptyPost] = emptyTpl.split('__LINK__');
    return (
      <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t('jobAgencyCompetitors.title', { agency: ownerAgency })}
        </h2>
        <p className="text-xs text-gray-600">
          {emptyPre}
          <Link href="/bid-tabs" className="text-yge-blue-500 hover:underline">/bid-tabs</Link>
          {emptyPost}
        </p>
      </section>
    );
  }

  const { rows, rollup } = buildCompetitorProfilesFromTabs(tabs);
  const top = rows.slice(0, topN);

  const tabsLabel =
    rollup.tabsConsidered === 1
      ? t('jobAgencyCompetitors.tabOne')
      : t('jobAgencyCompetitors.tabMany', { count: rollup.tabsConsidered });
  const compsLabel =
    rollup.uniqueCompetitors === 1
      ? t('jobAgencyCompetitors.compOne')
      : t('jobAgencyCompetitors.compMany', { count: rollup.uniqueCompetitors });
  const appsLabel =
    rollup.totalAppearances === 1
      ? t('jobAgencyCompetitors.appOne')
      : t('jobAgencyCompetitors.appMany', { count: rollup.totalAppearances });

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {t('jobAgencyCompetitors.title', { agency: ownerAgency })}
        </h2>
        <p className="text-[11px] text-gray-500">
          {tabsLabel} · {compsLabel} · {appsLabel}
        </p>
      </header>
      <table className="w-full text-xs">
        <thead className="bg-white text-[10px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">{t('jobAgencyCompetitors.thCompetitor')}</th>
            <th className="px-4 py-2 text-right">{t('jobAgencyCompetitors.thTabs')}</th>
            <th className="px-4 py-2 text-right">{t('jobAgencyCompetitors.thApparentLow')}</th>
            <th className="px-4 py-2 text-right">{t('jobAgencyCompetitors.thAvgBid')}</th>
            <th className="px-4 py-2 text-right">{t('jobAgencyCompetitors.thAvgRank')}</th>
            <th className="px-4 py-2 text-left">{t('jobAgencyCompetitors.thLastSeen')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {top.map((c) => {
            const lowRate = c.appearances > 0 ? c.apparentLowCount / c.appearances : 0;
            return (
              <tr key={c.nameNormalized}>
                <td className="px-4 py-2 align-top">
                  <div className="font-medium text-gray-900">{c.displayName}</div>
                  {(c.everDbe || c.everSbe) && (
                    <div className="text-[10px] text-gray-500">
                      {c.everDbe ? 'DBE' : ''}
                      {c.everDbe && c.everSbe ? ' · ' : ''}
                      {c.everSbe ? 'SBE' : ''}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 align-top text-right font-mono">{c.appearances}</td>
                <td className="px-4 py-2 align-top text-right font-mono">
                  {c.apparentLowCount}
                  <div className="text-[10px] text-gray-500">{(lowRate * 100).toFixed(0)}%</div>
                </td>
                <td className="px-4 py-2 align-top text-right font-mono">{formatMoney(c.avgBidCents)}</td>
                <td className="px-4 py-2 align-top text-right font-mono">{c.avgRank.toFixed(1)}</td>
                <td className="px-4 py-2 align-top font-mono text-[11px] text-gray-700">{c.lastSeenAt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > topN && (() => {
        // Footer template has an inline link — split-and-fill via __LINK__.
        const footerTpl = t('jobAgencyCompetitors.footer', {
          topN,
          rows: rows.length,
          link: '__LINK__',
        });
        const [footerPre, footerPost] = footerTpl.split('__LINK__');
        return (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-600">
            {footerPre}
            <Link href="/competitors" className="text-yge-blue-500 hover:underline">
              {t('jobAgencyCompetitors.fullTable')}
            </Link>
            {footerPost}
          </div>
        );
      })()}
    </section>
  );
}
