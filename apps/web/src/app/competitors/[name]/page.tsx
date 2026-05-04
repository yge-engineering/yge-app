// /competitors/[name] — single-competitor drilldown.
//
// nameNormalized is the path key (URL-encoded). Walks the bid-tab
// corpus, filters to tabs where the bidder's nameNormalized matches,
// and surfaces the full appearance history: agency, project,
// open date, total, rank, outcome.
//
// The rollup tiles at the top mirror /competitors's row for this
// bidder, so the operator can drill in / drill back without losing
// numbers in their head.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell, PageHeader, StatusPill } from '../../../components';
import {
  buildCompetitorProfilesFromTabs,
  computeHeadToHead,
  type BidTab,
} from '@yge/shared';
import { getTranslator } from '../../../lib/locale';

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

type AppearanceRow = {
  tabId: string;
  agencyName: string;
  source: BidTab['source'];
  county: string | undefined;
  projectName: string;
  projectNumber: string | undefined;
  bidOpenedAt: string;
  rank: number;
  totalCents: number;
  awarded: boolean;
  withdrawn: boolean;
  rejected: boolean;
  apparentLowName: string;
  apparentLowCents: number;
};

export default async function CompetitorDetailPage({
  params,
}: {
  params: { name: string };
}) {
  const nameNormalized = decodeURIComponent(params.name);
  const tabs = await fetchTabs();

  // Filter to tabs containing this competitor.
  const relevant = tabs.filter((t) =>
    t.bidders.some((b) => b.nameNormalized === nameNormalized),
  );

  if (relevant.length === 0) notFound();

  // Compute the rollup row for this competitor (recompute on the
  // unfiltered set + select; lets us reuse the helper instead of
  // duplicating math).
  const { rows } = buildCompetitorProfilesFromTabs(tabs);
  const me = rows.find((r) => r.nameNormalized === nameNormalized);
  if (!me) notFound();

  const t = getTranslator();
  const h2h = computeHeadToHead({ tabs, competitorNameNormalized: nameNormalized });

  // Per-appearance rows.
  const appearances: AppearanceRow[] = [];
  for (const t of relevant) {
    const myLine = t.bidders.find((b) => b.nameNormalized === nameNormalized);
    if (!myLine) continue;
    const apparent = t.bidders.find((b) => b.rank === 1);
    appearances.push({
      tabId: t.id,
      agencyName: t.agencyName,
      source: t.source,
      county: t.county,
      projectName: t.projectName,
      projectNumber: t.projectNumber,
      bidOpenedAt: t.bidOpenedAt,
      rank: myLine.rank,
      totalCents: myLine.totalCents,
      awarded: !!myLine.awardedTo,
      withdrawn: !!myLine.withdrawn,
      rejected: !!myLine.rejected,
      apparentLowName: apparent?.name ?? '',
      apparentLowCents: apparent?.totalCents ?? 0,
    });
  }
  appearances.sort((a, b) => (a.bidOpenedAt < b.bidOpenedAt ? 1 : -1));

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <Link href="/competitors" className="text-sm text-yge-blue-500 hover:underline">
          {t('compPg.back')}
        </Link>

        <PageHeader
          title={me.displayName}
          subtitle={t('compPg.subtitle', { appearances: me.appearances, appearancesWord: me.appearances === 1 ? t('compPg.appearanceOne') : t('compPg.appearanceMany'), agencies: me.topAgencies.length, agenciesWord: me.topAgencies.length === 1 ? t('compPg.agencyOne') : t('compPg.agencyMany'), first: me.firstSeenAt, last: me.lastSeenAt })}
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('compPg.tileApparentLow')} value={`${me.apparentLowCount} / ${me.appearances}`} sub={t('compPg.pctOfBids', { pct: ((me.apparentLowCount / me.appearances) * 100).toFixed(0) })} />
          <Tile label={t('compPg.tileAwarded')} value={String(me.awardCount)} />
          <Tile label={t('compPg.tileAvgBid')} value={formatMoney(me.avgBidCents)} sub={`${formatMoney(me.minBidCents)} – ${formatMoney(me.maxBidCents)}`} />
          <Tile label={t('compPg.tileAvgRank')} value={me.avgRank.toFixed(2)} sub={t('compPg.avgRankSub')} />
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <BreakdownTile
            label={t('compPg.tileTopAgencies')}
            rows={me.topAgencies.map((a) => ({ key: a.agencyName, count: a.count }))}
          />
          <BreakdownTile
            label={t('compPg.tileCounties')}
            rows={me.topCounties.map((c) => ({ key: c.county, count: c.count }))}
            empty={t('compPg.noCounty')}
          />
        </section>

        {h2h.events > 0 && (
          <section className="mt-4 rounded-md border border-yge-blue-500 bg-yge-blue-50 p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-yge-blue-500">
              {t('compPg.h2hHeader')}
            </h2>
            <p className="mb-3 text-xs text-gray-700">
              {t('compPg.h2hRange', { name: me.displayName, first: h2h.firstSeenAt ?? '', last: h2h.lastSeenAt ?? '' })}
            </p>
            <dl className="grid gap-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-gray-500">{t('compPg.h2hEvents')}</dt>
                <dd className="mt-0.5 text-2xl font-bold text-gray-900">{h2h.events}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-gray-500">{t('compPg.h2hYgeLower')}</dt>
                <dd className="mt-0.5 text-2xl font-bold text-emerald-700">
                  {h2h.ygeLowerCount}
                </dd>
                <dd className="text-[10px] text-gray-600">
                  {h2h.events > 0 ? `${((h2h.ygeLowerCount / h2h.events) * 100).toFixed(0)}%` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-gray-500">{t('compPg.h2hCompLower', { name: me.displayName })}</dt>
                <dd className="mt-0.5 text-2xl font-bold text-red-700">
                  {h2h.competitorLowerCount}
                </dd>
                <dd className="text-[10px] text-gray-600">
                  {h2h.events > 0 ? `${((h2h.competitorLowerCount / h2h.events) * 100).toFixed(0)}%` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-gray-500">{t('compPg.h2hAvgDelta')}</dt>
                <dd className="mt-0.5 font-mono text-base text-gray-900">
                  {h2h.avgYgeMinusCompetitorCents >= 0 ? '+' : ''}
                  {(h2h.avgYgeMinusCompetitorCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </dd>
                <dd className="text-[10px] text-gray-600">
                  {t('compPg.h2hVsTheirBid', { pct: (h2h.avgYgeMinusCompetitorPct * 100).toFixed(1) })}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-gray-600">
              {t('compPg.h2hSummary', { name: me.displayName, ygeAwards: h2h.ygeAwardedCount, compAwards: h2h.competitorAwardedCount, ygeLow: h2h.ygeApparentLowCount, compLow: h2h.competitorApparentLowCount })}
            </p>
          </section>
        )}

        {(me.everDbe || me.everSbe || me.everWithdrawn || me.everRejected || me.cslbLicense || me.dirRegistration) && (
          <section className="mt-4 rounded-md border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap gap-2 text-xs">
              {me.everDbe && <StatusPill label="DBE" tone="info" size="sm" />}
              {me.everSbe && <StatusPill label="SBE" tone="info" size="sm" />}
              {me.everWithdrawn && <StatusPill label={t('compPg.pillWithdrew')} tone="warn" size="sm" />}
              {me.everRejected && <StatusPill label={t('compPg.pillRejected')} tone="danger" size="sm" />}
              {me.cslbLicense && <span className="font-mono text-[11px] text-gray-700">CSLB {me.cslbLicense}</span>}
              {me.dirRegistration && <span className="font-mono text-[11px] text-gray-700">DIR {me.dirRegistration}</span>}
            </div>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
            {t('compPg.tableHeader')}
          </header>
          <table className="w-full text-sm">
            <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">{t('compPg.thOpened')}</th>
                <th className="px-3 py-2 text-left">{t('compPg.thProject')}</th>
                <th className="px-3 py-2 text-left">{t('compPg.thAgency')}</th>
                <th className="px-3 py-2 text-right">{t('compPg.thRank')}</th>
                <th className="px-3 py-2 text-right">{t('compPg.thTheirBid')}</th>
                <th className="px-3 py-2 text-right">{t('compPg.thVsLow')}</th>
                <th className="px-3 py-2 text-left">{t('compPg.thOutcome')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appearances.map((a) => {
                const overshoot =
                  a.apparentLowCents > 0
                    ? ((a.totalCents - a.apparentLowCents) / a.apparentLowCents) * 100
                    : 0;
                return (
                  <tr key={a.tabId}>
                    <td className="px-3 py-2 align-top font-mono text-xs">{a.bidOpenedAt.slice(0, 10)}</td>
                    <td className="px-3 py-2 align-top">
                      <Link href={`/bid-tabs/${a.tabId}`} className="font-medium text-yge-blue-500 hover:underline">
                        {a.projectName}
                      </Link>
                      {a.projectNumber && (
                        <div className="font-mono text-[10px] text-gray-500">{a.projectNumber}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-700">
                      {a.agencyName}
                      {a.county && <div className="text-[10px] text-gray-500">{a.county}</div>}
                    </td>
                    <td className="px-3 py-2 align-top text-right font-mono">{a.rank}</td>
                    <td className="px-3 py-2 align-top text-right font-mono">{formatMoney(a.totalCents)}</td>
                    <td className="px-3 py-2 align-top text-right font-mono text-xs text-gray-700">
                      {a.rank === 1 ? '—' : t('compPg.overshootPct', { pct: overshoot.toFixed(1) })}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {a.awarded && <StatusPill label={t('compPg.outAwarded')} tone="success" size="sm" />}
                      {a.withdrawn && <StatusPill label={t('compPg.outWithdrew')} tone="warn" size="sm" />}
                      {a.rejected && <StatusPill label={t('compPg.outRejected')} tone="danger" size="sm" />}
                      {a.rank > 1 && !a.awarded && !a.withdrawn && !a.rejected && (
                        <span className="text-xs text-gray-500">{t('compPg.outLost')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </AppShell>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-1 text-xs italic text-gray-600">{sub}</div>}
    </div>
  );
}

function BreakdownTile({
  label, rows, empty,
}: {
  label: string;
  rows: Array<{ key: string; count: number }>;
  empty?: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs italic text-gray-500">{empty ?? '—'}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between text-sm">
              <span className="text-gray-800">{r.key}</span>
              <span className="font-mono text-xs text-gray-600">×{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
