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
import { CopyBidSummaryButton } from '@/components/copy-bid-summary-button';
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
