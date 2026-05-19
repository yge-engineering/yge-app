// /estimates/[id]/post-award — single-screen launchpad summarizing what's
// next once the bid is awarded. Counts the §4104-listed subs we owe award
// letters to, names the big-ticket subs, and surfaces deep links to the
// three letter pages (award notice, Notice to Proceed, §4107 substitution
// request).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  classifySubBids,
  computeEstimateTotals,
  formatUSD,
  type PricedEstimate,
  type PricedEstimateTotals,
  type SubBid,
} from '@yge/shared';
import { AppShell, PageHeader } from '../../../../components';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface FullResponse {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}

async function fetchEstimate(id: string): Promise<FullResponse | null> {
  const res = await fetch(`${apiBaseUrl()}/api/priced-estimates/${id}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return (await res.json()) as FullResponse;
}

export default async function PostAwardLaunchpadPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate, totals } = data;
  const classification = classifySubBids(
    estimate.subBids,
    totals.bidTotalCents,
    estimate.projectType,
  );

  const recipients: SubBid[] = [
    ...classification.mustList,
    ...classification.borderline,
  ].sort((a, b) => b.bidAmountCents - a.bidAmountCents);

  const totalListedCents = recipients.reduce(
    (sum, s) => sum + s.bidAmountCents,
    0,
  );

  const awarded = estimate.bidStatus === 'awarded';

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-sm text-yge-blue-500 hover:underline"
          >
            &larr; Back to estimate
          </Link>
        </div>

        <PageHeader
          title="Post-award launchpad"
          subtitle="What to do once we win this bid — letters to print, subs to notify, and exception paths."
        />

        {!awarded && (
          <div className="mb-4 rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Bid is not marked awarded yet.</strong> The letters below
            still render as drafts, but don't send them until the agency
            formally awards the contract. Status: {estimate.bidStatus ?? 'pursuing'}.
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Listed subs to notify" value={String(recipients.length)} sub={recipients.length === 0 ? 'fully self-performed' : 'on §4104 list'} />
          <Stat label="Listed dollars" value={formatUSD(totalListedCents)} sub={`of ${formatUSD(totals.bidTotalCents)} bid`} />
          <Stat
            label="Big-ticket sub"
            value={recipients[0]?.contractorName ?? '—'}
            sub={recipients[0] ? formatUSD(recipients[0].bidAmountCents) : 'no subs'}
            />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ActionCard
            tone="green"
            title="Award notices"
            blurb="Print one letter per listed sub locking in their scope at the listed price. Each sub countersigns and returns."
            href={`/estimates/${estimate.id}/award-notices`}
            cta="Open award notices"
            disabled={recipients.length === 0}
          />
          <ActionCard
            tone="green-outline"
            title="Notice to Proceed"
            blurb="Once a subcontract is signed, draft an NTP so the sub knows when and where to mobilize."
            href={`/estimates/${estimate.id}/notice-to-proceed`}
            cta="Draft NTP"
            disabled={recipients.length === 0}
          />
          <ActionCard
            tone="amber"
            title="§4107 substitution"
            blurb="Exception path: a listed sub fails to perform after award. File a substitution request with the awarding authority."
            href={`/estimates/${estimate.id}/substitution-notice`}
            cta="Request substitution"
            disabled={recipients.length === 0}
          />
        </section>

        {recipients.length === 0 && (
          <div className="mt-6 rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
            No subs were listed on this bid. Either the work is fully
            self-performed, or every sub bid was under the §4104 threshold.
            Nothing to notify, nothing to substitute.
          </div>
        )}

        {recipients.length > 0 && (
          <section className="mt-6 rounded border border-gray-200 bg-white p-3 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Listed subs (in print order)
            </h2>
            <ul className="mt-2 divide-y divide-gray-100">
              {recipients.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                  <span>
                    <span className="font-semibold">{s.contractorName}</span>{' '}
                    <span className="text-gray-500">— {s.portionOfWork}</span>
                  </span>
                  <span className="font-mono text-xs text-gray-700">
                    {formatUSD(s.bidAmountCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-xl font-bold text-yge-blue-900">{value}</div>
      <div className="mt-1 text-[11px] text-gray-500">{sub}</div>
    </div>
  );
}

function ActionCard({
  title,
  blurb,
  href,
  cta,
  tone,
  disabled,
}: {
  title: string;
  blurb: string;
  href: string;
  cta: string;
  tone: 'green' | 'green-outline' | 'amber';
  disabled?: boolean;
}) {
  const ctaTone =
    tone === 'green'
      ? 'bg-green-600 text-white hover:bg-green-700'
      : tone === 'green-outline'
        ? 'border border-green-500 text-green-700 hover:bg-green-50'
        : 'border border-amber-400 text-amber-800 hover:bg-amber-50';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-xs text-gray-600">{blurb}</p>
      {disabled ? (
        <span className="mt-3 inline-block rounded bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400">
          {cta}
        </span>
      ) : (
        <Link
          href={href}
          className={`mt-3 inline-block rounded px-3 py-1.5 text-xs font-semibold ${ctaTone}`}
        >
          {cta} →
        </Link>
      )}
    </div>
  );
}
