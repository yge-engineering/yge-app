// /bid-results/[id] — edit a bid result; bidder list editor + outcome.

import Link from 'next/link';

import { AppShell, AuditBinderPanel, StatusPill } from '../../../components';
import { notFound } from 'next/navigation';
import type { BidResult, BidTab, Job } from '@yge/shared';
import { BidResultEditor } from '@/components/bid-result-editor';
import { getTranslator, type Translator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchResult(id: string): Promise<BidResult | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/bid-results/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { result: BidResult };
  return json.result;
}
async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${apiBaseUrl()}/api/jobs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { jobs: Job[] }).jobs;
}
async function fetchLinkedBidTab(bidResultId: string): Promise<BidTab | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bid-tabs`, { cache: 'no-store' });
    if (!res.ok) return null;
    const tabs = ((await res.json()) as { tabs: BidTab[] }).tabs;
    return tabs.find((t) => t.ygeBidResultId === bidResultId) ?? null;
  } catch { return null; }
}

function formatMoney(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function BidResultDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [result, jobs, linkedTab] = await Promise.all([
    fetchResult(params.id),
    fetchJobs(),
    fetchLinkedBidTab(params.id),
  ]);
  if (!result) notFound();
  const job = jobs.find((j) => j.id === result.jobId);
  const t = getTranslator();

  return (
    <AppShell>
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <Link href="/bid-results" className="text-sm text-yge-blue-500 hover:underline">
          {t('bidResultPg.back')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <BidResultEditor
          initial={result}
          job={job}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>

      {linkedTab && <LinkedBidTabPanel tab={linkedTab} t={t} />}

      <AuditBinderPanel entityType="BidResult" entityId={result.id} />
    </main>
    </AppShell>
  );
}

function LinkedBidTabPanel({ tab, t }: { tab: BidTab; t: Translator }) {
  const apparent = tab.bidders.find((b) => b.rank === 1);
  const ee = tab.engineersEstimateCents;
  return (
    <section className="mt-6 rounded-lg border border-yge-blue-500 bg-yge-blue-50 p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-yge-blue-500">
            {t('bidResultPg.linkedHeader')}
          </h2>
          <p className="text-xs text-gray-700">
            {t('bidResultPg.linkedSubtitle', { agency: tab.agencyName, source: tab.source, date: tab.bidOpenedAt.slice(0, 10) })}
          </p>
        </div>
        <Link
          href={`/bid-tabs/${tab.id}`}
          className="rounded bg-yge-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yge-blue-700"
        >
          {t('bidResultPg.openTab')}
        </Link>
      </header>
      <dl className="grid gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">{t('bidResultPg.lblApparentLow')}</dt>
          <dd className="mt-0.5 font-mono text-gray-900">
            {apparent ? formatMoney(apparent.totalCents) : '—'}
          </dd>
          {apparent && (
            <dd className="text-[10px] text-gray-600">{apparent.name}</dd>
          )}
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">{t('bidResultPg.lblEngineerEst')}</dt>
          <dd className="mt-0.5 font-mono text-gray-900">
            {ee ? formatMoney(ee) : '—'}
          </dd>
          {apparent && ee && (
            <dd className="text-[10px] text-gray-600">
              {apparent.totalCents > ee ? t('bidResultPg.lowDeltaPositive', { pct: (((apparent.totalCents - ee) / ee) * 100).toFixed(1) }) : t('bidResultPg.lowDeltaNegative', { pct: (((apparent.totalCents - ee) / ee) * 100).toFixed(1) })}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">{t('bidResultPg.lblBidders')}</dt>
          <dd className="mt-0.5 font-mono text-gray-900">{tab.bidders.length}</dd>
          {tab.county && (
            <dd className="text-[10px] text-gray-600">{t('bidResultPg.countySuffix', { county: tab.county })}</dd>
          )}
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1">
        {tab.bidders.slice(0, 5).map((b) => (
          <StatusPill
            key={`${b.rank}-${b.nameNormalized}`}
            label={`${b.rank}. ${b.name.length > 28 ? `${b.name.slice(0, 26)}…` : b.name}`}
            tone={b.awardedTo ? 'success' : b.rank === 1 ? 'info' : 'neutral'}
            size="sm"
          />
        ))}
        {tab.bidders.length > 5 && (
          <span className="text-[10px] text-gray-500 self-center">{t('bidResultPg.moreSuffix', { count: tab.bidders.length - 5 })}</span>
        )}
      </div>
    </section>
  );
}
