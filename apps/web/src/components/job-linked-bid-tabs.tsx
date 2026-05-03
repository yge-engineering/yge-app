// Linked-bid-tabs panel for /jobs/[id].
//
// Lists every public BidTab whose ygeJobId points at this job —
// the agency's posted tabulation of the bid open. Closes the
// loop with bundle 622's auto-link and bundle 633's manual link
// form: from either side (the YGE row or the public tab) the
// operator gets one click to the other.

import Link from 'next/link';
import type { BidTab } from '@yge/shared';
import { getTranslator } from '../lib/locale';

interface Props {
  apiBaseUrl: string;
  jobId: string;
}

async function fetchTabsForJob(apiBaseUrl: string, jobId: string): Promise<BidTab[]> {
  try {
    // /api/bid-tabs supports ?ygeJobId=... directly.
    const res = await fetch(
      `${apiBaseUrl}/api/bid-tabs?ygeJobId=${encodeURIComponent(jobId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return [];
    return ((await res.json()) as { tabs: BidTab[] }).tabs;
  } catch { return []; }
}

function formatMoney(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export async function JobLinkedBidTabs({ apiBaseUrl, jobId }: Props) {
  const tabs = await fetchTabsForJob(apiBaseUrl, jobId);
  if (tabs.length === 0) return null;
  const tr = getTranslator();

  return (
    <section className="mt-6 rounded-lg border border-yge-blue-500 bg-yge-blue-50 p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-yge-blue-500">
          {tabs.length === 1
            ? tr('jobLinkedBidTabs.titleOne')
            : tr('jobLinkedBidTabs.titleMany')}
        </h2>
        <p className="text-[11px] text-gray-600">{tr('jobLinkedBidTabs.intro')}</p>
      </header>
      <ul className="space-y-2">
        {tabs.map((t) => {
          const apparent = t.bidders.find((b) => b.rank === 1);
          return (
            <li key={t.id} className="rounded border border-gray-200 bg-white p-3 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/bid-tabs/${t.id}`}
                  className="font-medium text-yge-blue-500 hover:underline"
                >
                  {t.projectName}
                </Link>
                <span className="font-mono text-[10px] text-gray-500">
                  {t.source} · {tr('jobLinkedBidTabs.opened', { date: t.bidOpenedAt.slice(0, 10) })}
                </span>
              </div>
              <dl className="mt-1 grid gap-1 text-[11px] sm:grid-cols-3">
                <div>
                  <dt className="text-gray-500">{tr('jobLinkedBidTabs.apparentLow')}</dt>
                  <dd className="font-mono text-gray-900">
                    {apparent ? formatMoney(apparent.totalCents) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{tr('jobLinkedBidTabs.bidders')}</dt>
                  <dd className="font-mono text-gray-900">{t.bidders.length}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{tr('jobLinkedBidTabs.engineersEst')}</dt>
                  <dd className="font-mono text-gray-900">
                    {t.engineersEstimateCents ? formatMoney(t.engineersEstimateCents) : '—'}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

