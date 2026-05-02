// /bid-tabs/[id] — one bid tab + ranked bidder list.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell, PageHeader, StatusPill } from '../../../components';
import type { BidTab } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTab(id: string): Promise<BidTab | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bid-tabs/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return ((await res.json()) as { tab: BidTab }).tab;
  } catch { return null; }
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default async function BidTabPage({
  params,
}: {
  params: { id: string };
}) {
  const tab = await fetchTab(params.id);
  if (!tab) notFound();

  const apparent = tab.bidders.find((b) => b.rank === 1);
  const ee = tab.engineersEstimateCents;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <Link href="/bid-tabs" className="text-sm text-yge-blue-500 hover:underline">
          &larr; All bid tabs
        </Link>

        <PageHeader
          title={tab.projectName}
          subtitle={`${tab.agencyName} · ${tab.source} · opened ${tab.bidOpenedAt.slice(0, 10)}`}
        />

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tile
            label="Apparent low"
            value={apparent ? formatMoney(apparent.totalCents) : '—'}
            sub={apparent?.name}
          />
          <Tile
            label="Engineer's estimate"
            value={ee ? formatMoney(ee) : '—'}
            sub={apparent && ee ? `low ${apparent.totalCents > ee ? '+' : ''}${(((apparent.totalCents - ee) / ee) * 100).toFixed(1)}%` : undefined}
          />
          <Tile
            label="Bidders on tab"
            value={String(tab.bidders.length)}
            sub={tab.county ? `${tab.county} County` : undefined}
          />
        </section>

        {tab.notes && (
          <section className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <strong className="font-semibold text-gray-900">Notes</strong>
            <div className="mt-1 whitespace-pre-wrap">{tab.notes}</div>
          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Rank</th>
                <th className="px-3 py-2 text-left">Bidder</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">vs. low</th>
                <th className="px-3 py-2 text-left">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tab.bidders.map((b) => {
                const deltaPct =
                  apparent && apparent.totalCents > 0
                    ? ((b.totalCents - apparent.totalCents) / apparent.totalCents) * 100
                    : 0;
                return (
                  <tr key={`${b.rank}-${b.nameNormalized}`}>
                    <td className="px-3 py-2 align-top font-mono text-xs">{b.rank}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-gray-900">{b.name}</div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {b.cslbLicense ?? ''} {b.dirRegistration ? `· DIR ${b.dirRegistration}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right font-mono">
                      {formatMoney(b.totalCents)}
                    </td>
                    <td className="px-3 py-2 align-top text-right font-mono text-xs text-gray-700">
                      {b.rank === 1 ? '—' : `+${deltaPct.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {b.awardedTo && <StatusPill label="awarded" tone="success" size="sm" />}
                      {b.dbe && <StatusPill label="DBE" tone="info" size="sm" />}
                      {b.sbe && <StatusPill label="SBE" tone="info" size="sm" />}
                      {b.withdrawn && <StatusPill label="withdrawn" tone="warn" size="sm" />}
                      {b.rejected && <StatusPill label="rejected" tone="danger" size="sm" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="mt-6 text-xs text-gray-500">
          Source URL{' '}
          {tab.sourceUrl ? (
            <a
              href={tab.sourceUrl}
              className="text-yge-blue-500 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              open ↗
            </a>
          ) : (
            <span className="italic">not captured</span>
          )}{' '}
          · scraped {tab.scrapedAt.replace('T', ' ').slice(0, 16)} ·{' '}
          {tab.scraperJobId ? `job ${tab.scraperJobId}` : 'manual import'}
        </p>
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
