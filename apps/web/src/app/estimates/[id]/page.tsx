// /estimates/[id] — editable priced estimate.
//
// Server component fetches the saved estimate; the EstimateEditor client
// component handles all the inline edits, debouncing, and PATCH calls.

import Link from 'next/link';

import {
  AppShell,
  AuditBinderPanel,
  MarkupWhatIfSlider,
  P2eFeedbackCard,
} from '../../../components';
import { getCurrentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import type { PricedEstimate, PricedEstimateTotals } from '@yge/shared';
import { EstimateEditor } from '@/components/estimate-editor';
import { BidDueBanner } from '@/components/bid-due-banner';
import { CopyEstimateLink } from '@/components/copy-estimate-link';
import { relativeTime } from '@/lib/relative-time';
import { CopyBidSummaryButton } from '@/components/copy-bid-summary-button';
import { CopyPageUrlButton } from '@/components/copy-page-url-button';
import { CopyIdChip } from '@/components/copy-id-chip';
import { BidStatusSwitcher } from '@/components/bid-status-switcher';
import { getTranslator } from '../../../lib/locale';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
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

export default async function EstimateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTranslator();
  const data = await fetchEstimate(params.id);
  if (!data) notFound();

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Link href="/estimates" className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50">
          {t('estPg.back')}
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <CopyIdChip id={data.estimate.id} label="id" />
          <span
            className="text-xs text-gray-500"
            title={data.estimate.updatedAt}
          >
            Last edit {relativeTime(data.estimate.updatedAt)}
          </span>
          <Link
            href={`/jobs/${data.estimate.jobId}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
            title="Open the job this estimate is attached to"
          >
            ↗ Open job
          </Link>
          <Link
            href={`/drafts/${data.estimate.fromDraftId}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            {t('estPg.viewDraft')}
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(() => {
          const unpricedCount = data.estimate.bidItems.filter(
            (i) => i.unitPriceCents == null,
          ).length;
          if (unpricedCount === 0) return null;
          return (
            <div className="inline-flex items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
              <span>⚠</span>
              <span>
                {unpricedCount} unpriced line{unpricedCount === 1 ? '' : 's'} — finish before submitting.
              </span>
            </div>
          );
        })()}
        {!data.estimate.bidSecurity && (
          <Link
            href={`/estimates/${data.estimate.id}/envelope`}
            className="inline-flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            <span>⚠</span>
            <span>Bid security not set — open envelope to add bond / cashier check.</span>
          </Link>
        )}
        {(() => {
          const addenda = data.estimate.addenda ?? [];
          const unacked = addenda.filter((a) => !a.acknowledged).length;
          if (addenda.length === 0 || unacked === 0) return null;
          return (
            <Link
              href={`/estimates/${data.estimate.id}/addenda`}
              className="inline-flex items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
            >
              <span>⚠</span>
              <span>
                {unacked} of {addenda.length} addend{unacked === 1 ? 'um' : 'a'} un-acknowledged — bid will be non-responsive.
              </span>
            </Link>
          );
        })()}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link
          href={`/estimates/${data.estimate.id}/coach`}
          className="rounded border border-amber-500 bg-amber-50 px-3 py-1 font-medium text-amber-800 hover:bg-amber-100"
        >
          {t('estPg.preSubmit')}
        </Link>
        <Link
          href={`/estimates/${data.estimate.id}/scope-gap`}
          className="rounded border border-blue-500 bg-blue-50 px-3 py-1 font-medium text-blue-800 hover:bg-blue-100"
        >
          {t('estPg.scopeGap')}
        </Link>
        <Link
          href={`/estimates/${data.estimate.id}/print`}
          className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          {t('estPg.print')}
        </Link>
        <Link
          href={`/estimates/${data.estimate.id}/transmittal`}
          className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          {t('estPg.coverLetter')}
        </Link>
        <Link
          href={`/estimates/${data.estimate.id}/envelope`}
          className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          {t('estPg.envelope')}
        </Link>
        <Link
          href={`/estimates/${data.estimate.id}/sub-list`}
          className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          {t('estPg.subList')}
        </Link>
        <Link
          href={`/estimates/${data.estimate.id}/sub-leveling`}
          className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          Sub leveling
        </Link>
        <Link
          href={`/estimates/${data.estimate.id}/addenda`}
          className="rounded border border-yge-blue-500 px-3 py-1 font-medium text-yge-blue-500 hover:bg-yge-blue-50"
        >
          {t('estPg.addenda')}
        </Link>
        <BidStatusSwitcher
          apiBaseUrl={publicApiBaseUrl()}
          estimateId={data.estimate.id}
          current={data.estimate.bidStatus}
          submittedAt={data.estimate.bidSubmittedAt}
        />
        <CopyPageUrlButton />
        <CopyBidSummaryButton
          projectName={data.estimate.projectName}
          bidTotalCents={data.totals.bidTotalCents}
          bidItemCount={data.estimate.bidItems.length}
          subBidCount={data.estimate.subBids?.length ?? 0}
        />
        <CopyEstimateLink
          sourceId={data.estimate.id}
          sourceProjectName={data.estimate.projectName}
          sourceJobId={data.estimate.jobId}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>

      <div className="mb-4">
        <BidDueBanner bidDueDate={data.estimate.bidDueDate} />
      </div>

      <div className="mb-4">
        <MarkupWhatIfSlider
          estimateId={data.estimate.id}
          apiBaseUrl={publicApiBaseUrl()}
          currentOppPercent={data.estimate.oppPercent}
          directCostCents={data.totals.directCents}
        />
      </div>

      {(() => {
        const status = data.estimate.bidStatus ?? 'pursuing';
        const STEPS = [
          { id: 'pursuing', label: 'Pursuing' },
          { id: 'submitted', label: 'Submitted' },
          { id: status === 'lost' ? 'lost' : 'awarded', label: status === 'lost' ? 'Lost' : 'Awarded' },
        ];
        const activeIdx =
          status === 'awarded' || status === 'lost' ? 2 : status === 'submitted' ? 1 : 0;
        return (
          <ol className="mb-4 flex items-center gap-1 text-xs">
            {STEPS.map((step, i) => {
              const reached = i <= activeIdx;
              const tone = reached
                ? status === 'lost' && i === 2
                  ? 'border-gray-300 bg-gray-100 text-gray-700'
                  : status === 'awarded' && i === 2
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : status === 'submitted' && i === 1
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-gray-200 bg-white text-gray-400';
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-0.5 ${tone}`}
                >
                  <span className="font-mono text-[10px] opacity-60">{i + 1}</span>
                  <span>{step.label}</span>
                </li>
              );
            })}
          </ol>
        );
      })()}

      {(() => {
        const unpriced = data.estimate.bidItems.filter((i) => i.unitPriceCents == null).length;
        const checks = [
          { ok: unpriced === 0, label: unpriced === 0 ? 'All lines priced' : `${unpriced} line${unpriced === 1 ? '' : 's'} unpriced` },
          { ok: !!data.estimate.bidSecurity, label: data.estimate.bidSecurity ? 'Bid security set' : 'Bid security not set' },
          (() => {
            const addenda = data.estimate.addenda ?? [];
            const unacked = addenda.filter((a) => !a.acknowledged).length;
            if (addenda.length === 0) return { ok: true, label: 'No addenda logged' };
            return {
              ok: unacked === 0,
              label: unacked === 0 ? 'All addenda acknowledged' : `${unacked} of ${addenda.length} un-acknowledged`,
            };
          })(),
          {
            ok: (data.estimate.subBids ?? []).length > 0,
            label: (data.estimate.subBids ?? []).length > 0
              ? `${(data.estimate.subBids ?? []).length} sub bid${(data.estimate.subBids ?? []).length === 1 ? '' : 's'} listed`
              : 'No sub bids listed (§4104)',
          },
        ];
        const allOk = checks.every((c) => c.ok);
        return (
          <div className={`mb-4 rounded-lg border p-3 ${allOk ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Bid readiness
            </div>
            <ul className="space-y-1 text-xs">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={c.ok ? 'text-green-700' : 'text-red-700'}>
                    {c.ok ? '✓' : '✗'}
                  </span>
                  <span className={c.ok ? 'text-gray-800' : 'text-red-800'}>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <EstimateEditor
          initialEstimate={data.estimate}
          initialTotals={data.totals}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>

      {data.estimate.fromDraftId && (
        <div className="mt-6">
          <P2eFeedbackCard
            apiBaseUrl={publicApiBaseUrl()}
            estimateId={data.estimate.id}
            draftId={data.estimate.fromDraftId}
            byEmail={getCurrentUser()?.email}
          />
        </div>
      )}

      <AuditBinderPanel entityType="Estimate" entityId={data.estimate.id} />
    </main>
    </AppShell>
  );
}
