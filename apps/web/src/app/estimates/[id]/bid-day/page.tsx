// /estimates/[id]/bid-day — the "bid day cockpit".
//
// One screen the estimator opens on bid day. Shows:
//   - Big countdown banner (color-coded by urgency)
//   - Readiness summary (READY / READY-WITH-CAVEATS / NOT READY) +
//     full checklist breakdown by severity
//   - Bid security state with the calculated amount
//   - Envelope checklist preview (first N required items)
//   - Action grid linking to every print artifact in one click
//
// All the building blocks already exist in @yge/shared — this page
// just stitches them together. Server-rendered.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  bidDueCountdown,
  bidSecurityAmountCents,
  bidSecurityTypeLabel,
  buildEnvelopeChecklist,
  computeBidChecklist,
  computeEstimateTotals,
  formatUSD,
  type BidChecklist,
  type BidChecklistItem,
  type BidDueCountdown,
  type PricedEstimate,
  type PricedEstimateTotals,
} from '@yge/shared';
import { AppShell, PageHeader } from '../../../../components';
import { PrintPacketButton } from '@/components/print-packet-button';
import { BidDayComparableCallout } from '@/components/bid-day-comparable-callout';

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

export default async function BidDayPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await fetchEstimate(params.id);
  if (!data) notFound();
  const { estimate } = data;
  const totals = computeEstimateTotals(estimate);
  const checklist = computeBidChecklist(estimate, totals);
  const envelope = buildEnvelopeChecklist(estimate, totals);
  const countdown = bidDueCountdown(estimate.bidDueDate);

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between text-sm">
          <Link
            href={`/estimates/${estimate.id}`}
            className="text-yge-blue-500 hover:underline"
          >
            ← Back to estimate editor
          </Link>
          <PrintPacketButton estimateId={estimate.id} />
        </div>

        <PageHeader
          title="Bid day"
          subtitle={`${estimate.projectName}${estimate.ownerAgency ? ` · ${estimate.ownerAgency}` : ''} · bid total ${formatUSD(totals.bidTotalCents, { compact: true })}`}
        />

        <CountdownBanner countdown={countdown} bidDueDate={estimate.bidDueDate} />

        <BidDayComparableCallout estimate={estimate} />

        <ReadinessBanner checklist={checklist} />

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChecklistSection checklist={checklist} />
          </div>
          <div className="space-y-4">
            <BidSecurityCard estimate={estimate} totals={totals} />
            <EnvelopePreviewCard envelopeItems={envelope.items.slice(0, 6)} />
          </div>
        </div>

        <ActionGrid estimateId={estimate.id} />
      </main>
    </AppShell>
  );
}

// ---- Pieces ----------------------------------------------------------

function CountdownBanner({
  countdown,
  bidDueDate,
}: {
  countdown: BidDueCountdown;
  bidDueDate: string | undefined;
}) {
  if (countdown.level === 'none') {
    return (
      <section className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">No bid due date set</p>
        <p className="mt-1 text-xs text-gray-600">
          Add a bid due date on the estimate so the countdown can fire.
        </p>
      </section>
    );
  }
  const tone =
    countdown.level === 'red'
      ? 'border-red-300 bg-red-50 text-red-900'
      : countdown.level === 'orange'
        ? 'border-orange-300 bg-orange-50 text-orange-900'
        : countdown.level === 'yellow'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-emerald-300 bg-emerald-50 text-emerald-900';
  return (
    <section className={`mt-2 rounded-md border-2 p-5 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
            Bid due
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums">
            {countdown.shortLabel}
          </div>
          <div className="mt-1 text-sm">{countdown.longLabel}</div>
        </div>
        {bidDueDate && (
          <div className="text-right text-xs">
            <div className="opacity-80">Per RFP</div>
            <div className="mt-0.5 font-semibold">{bidDueDate}</div>
            {countdown.parsedFromTextOnly && (
              <p className="mt-1 max-w-[220px] text-[10px] italic opacity-80">
                No time of day — bid due date parsed as midnight. Add a time
                if the agency printed one.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ReadinessBanner({ checklist }: { checklist: BidChecklist }) {
  if (checklist.allClear) {
    return (
      <section className="mt-4 rounded-md border-2 border-emerald-300 bg-emerald-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Status
        </div>
        <div className="mt-1 text-2xl font-bold text-emerald-900">
          ✓ All clear — ready to submit
        </div>
        <p className="mt-1 text-sm text-emerald-800">
          Every blocker + every recommended item is green. Print the packet
          and seal the envelope.
        </p>
      </section>
    );
  }
  if (checklist.readyToSubmit) {
    return (
      <section className="mt-4 rounded-md border-2 border-amber-300 bg-amber-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Status
        </div>
        <div className="mt-1 text-2xl font-bold text-amber-900">
          ⚠ Ready with caveats
        </div>
        <p className="mt-1 text-sm text-amber-800">
          Every blocker passed. {checklist.recommendedWarnCount} recommended
          item{checklist.recommendedWarnCount === 1 ? '' : 's'} still need{checklist.recommendedWarnCount === 1 ? 's' : ''}{' '}
          attention — review below before sealing the envelope.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-4 rounded-md border-2 border-red-300 bg-red-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-red-700">
        Status
      </div>
      <div className="mt-1 text-2xl font-bold text-red-900">
        ✗ Not ready — {checklist.blockerFailCount} blocker
        {checklist.blockerFailCount === 1 ? '' : 's'}
      </div>
      <p className="mt-1 text-sm text-red-800">
        Submitting now risks a non-responsive bid. Fix the red items below
        first.
      </p>
    </section>
  );
}

function ChecklistSection({ checklist }: { checklist: BidChecklist }) {
  const blockers = checklist.items.filter((i) => i.severity === 'blocker');
  const recommended = checklist.items.filter((i) => i.severity === 'recommended');
  return (
    <section className="rounded-md border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Pre-submit checklist
        </h3>
      </header>
      <div className="divide-y divide-gray-100">
        <ChecklistGroup title="Blockers" items={blockers} />
        {recommended.length > 0 && (
          <ChecklistGroup title="Recommended" items={recommended} />
        )}
      </div>
    </section>
  );
}

function ChecklistGroup({
  title,
  items,
}: {
  title: string;
  items: BidChecklistItem[];
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </div>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-xs">
              {item.status === 'pass' ? (
                <span className="text-emerald-700">✓</span>
              ) : item.status === 'warn' ? (
                <span className="text-amber-700">!</span>
              ) : (
                <span className="text-red-700">✗</span>
              )}
            </span>
            <div className="flex-1">
              <div
                className={
                  item.status === 'pass'
                    ? 'text-gray-700'
                    : item.status === 'warn'
                      ? 'font-medium text-amber-900'
                      : 'font-medium text-red-900'
                }
              >
                {item.label}
              </div>
              {item.detail && (
                <div className="mt-0.5 text-xs text-gray-500">{item.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BidSecurityCard({
  estimate,
  totals,
}: {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
}) {
  const sec = estimate.bidSecurity;
  if (!sec) {
    return (
      <section className="rounded-md border border-red-200 bg-red-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Bid security
        </h3>
        <p className="mt-2 text-sm text-red-900">
          Not configured. Most CA public-works bids are non-responsive without
          a bid bond / cashier&apos;s check / certified check.
        </p>
        <Link
          href={`/estimates/${estimate.id}/envelope`}
          className="mt-2 inline-block text-xs font-semibold text-red-700 underline"
        >
          Add bid security →
        </Link>
      </section>
    );
  }
  const amount = bidSecurityAmountCents(totals.bidTotalCents, sec);
  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Bid security
      </h3>
      <div className="mt-1 text-sm font-semibold text-gray-900">
        {bidSecurityTypeLabel(sec.type)}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-gray-900">
        {formatUSD(amount)}
      </div>
      <div className="text-[11px] text-gray-500">
        {(sec.percent * 100).toFixed(0)}% of bid total
      </div>
      {sec.type === 'BID_BOND' && sec.suretyName && (
        <div className="mt-2 text-xs text-gray-600">
          Surety: <span className="font-medium">{sec.suretyName}</span>
        </div>
      )}
      {sec.bondNumber && (
        <div className="text-xs text-gray-600">
          Bond #: <span className="font-medium">{sec.bondNumber}</span>
        </div>
      )}
    </section>
  );
}

function EnvelopePreviewCard({
  envelopeItems,
}: {
  envelopeItems: ReturnType<typeof buildEnvelopeChecklist>['items'];
}) {
  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Envelope contents (top {envelopeItems.length})
      </h3>
      <ul className="mt-2 space-y-1 text-xs text-gray-700">
        {envelopeItems.map((item) => (
          <li key={item.id} className="flex items-start gap-1.5">
            <span
              className={`mt-0.5 inline-block h-3 w-3 flex-shrink-0 rounded border ${item.warn ? 'border-red-400 bg-red-50' : 'border-gray-400'}`}
            />
            <span className={item.warn ? 'text-red-900' : ''}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActionGrid({ estimateId }: { estimateId: string }) {
  const links: Array<{ href: string; label: string; sub: string }> = [
    {
      href: `/estimates/${estimateId}/print`,
      label: 'Bid summary',
      sub: 'Single-page bid form ready to print',
    },
    {
      href: `/estimates/${estimateId}/sub-list`,
      label: '§4104 sub list',
      sub: 'CA Pub Cont Code subcontractor listing',
    },
    {
      href: `/estimates/${estimateId}/transmittal`,
      label: 'Cover letter',
      sub: 'Transmittal to the agency',
    },
    {
      href: `/estimates/${estimateId}/envelope`,
      label: 'Envelope checklist',
      sub: 'Tick items as you stuff the envelope',
    },
    {
      href: `/estimates/${estimateId}/addenda`,
      label: 'Addenda',
      sub: 'Confirm every addendum is acknowledged',
    },
    {
      href: `/estimates/${estimateId}/sub-leveling`,
      label: 'Sub leveling',
      sub: 'Compare quotes per scope',
    },
  ];
  return (
    <section className="mt-6 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Bid packet — individual artifacts
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-md border border-gray-200 bg-white p-3 text-left hover:border-yge-blue-500 hover:bg-yge-blue-50"
          >
            <div className="text-sm font-semibold text-gray-900">{l.label}</div>
            <div className="mt-0.5 text-[11px] text-gray-500">{l.sub}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
