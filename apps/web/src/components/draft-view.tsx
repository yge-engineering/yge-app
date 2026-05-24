'use client';

// Renders a Plans-to-Estimate draft — header, bid items, assumptions, open
// questions, footer. Marked 'use client' because the CSV buttons use the
// browser-only Blob, navigator.clipboard, and DOM-anchor APIs.
//
// Used by:
//   - /plans-to-estimate (renders the live result of an AI run)
//   - /drafts/[id]       (renders a saved draft from the API)

import { useState } from 'react';
import type { PtoEOutput, PtoEBidItem, PtoEItemConfidence } from '@yge/shared';
import { useTranslator, type Translator } from '../lib/use-translator';
import { bidItemsToCsv, formatUSD, sumPtoEBidTotalCents } from '@yge/shared';

// CSV row generation lives in @yge/shared/csv so the API can emit the same
// bytes from a future server-side download endpoint. The UI just picks the
// filename and triggers the download / clipboard write.

function safeFilename(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return (slug || 'draft-estimate') + '-bid-items.csv';
}

// ---- Components ----------------------------------------------------------

export interface DraftViewProps {
  draft: PtoEOutput;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  /** Render time on the server (ms). null when not yet known. */
  elapsedMs: number | null;
}

export function DraftView({
  draft,
  modelUsed,
  promptVersion,
  usage,
  elapsedMs,
}: DraftViewProps) {
  const t = useTranslator();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  function handleDownloadCsv() {
    const csv = bidItemsToCsv(draft.bidItems);
    // BOM helps Excel detect UTF-8 cleanly when the file has any non-ASCII chars.
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename(draft.projectName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCopyCsv() {
    const csv = bidItemsToCsv(draft.bidItems);
    try {
      await navigator.clipboard.writeText(csv);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 3000);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold text-gray-900">{draft.projectName}</h2>
        <p className="text-sm text-gray-600">
          {draft.projectType.replace(/_/g, ' ')}
          {draft.location && t('draftView.subtitleSep', { value: draft.location })}
          {draft.ownerAgency && t('draftView.subtitleSep', { value: draft.ownerAgency })}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
          {draft.bidDueDate && (
            <>
              <dt className="font-medium">{t('draftView.lblBidDue')}</dt>
              <dd>{draft.bidDueDate}</dd>
            </>
          )}
          {draft.prebidMeeting && (
            <>
              <dt className="font-medium">{t('draftView.lblPrebid')}</dt>
              <dd>{draft.prebidMeeting}</dd>
            </>
          )}
          <dt className="font-medium">{t('draftView.lblConfidence')}</dt>
          <dd>
            <ConfidencePill value={draft.overallConfidence} />
          </dd>
        </dl>
      </header>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('draftView.bidItemsHeader')}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100"
              title={t('draftView.downloadCsvTip')}
            >
              {t('draftView.downloadCsv')}
            </button>
            <button
              onClick={handleCopyCsv}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title={t('draftView.copyCsvTip')}
            >
              {copyState === 'copied'
                ? t('draftView.copyCopied')
                : copyState === 'error'
                  ? t('draftView.copyError')
                  : t('draftView.copyCsv')}
            </button>
          </div>
        </div>
        <ul className="mt-2 divide-y divide-gray-100">
          {draft.bidItems.map((item, i) => (
            <BidItemRow key={i} item={item} t={t} />
          ))}
        </ul>
        <BidTotalRow draft={draft} />
      </div>

      {draft.assumptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('draftView.assumptionsHeader')}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {draft.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {draft.questionsForEstimator.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('draftView.questionsHeader')}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {draft.questionsForEstimator.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="border-t border-gray-100 pt-3 text-xs text-gray-400">
        {t('draftView.footer', { model: modelUsed, prompt: promptVersion, input: usage.inputTokens.toLocaleString(), output: usage.outputTokens.toLocaleString() })}
        {elapsedMs != null && t('draftView.footerElapsed', { seconds: (elapsedMs / 1000).toFixed(1) })}
      </footer>
    </div>
  );
}

function BidItemRow({ item, t }: { item: PtoEBidItem; t: Translator }) {
  const hasPrice = item.estimatedUnitPriceCents !== undefined;
  // Recompute line total defensively — if the model only filled the unit
  // price we still want a number for display.
  const lineCents =
    item.estimatedLineTotalCents ??
    (hasPrice
      ? Math.round(item.quantity * (item.estimatedUnitPriceCents ?? 0))
      : undefined);

  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            <span className="text-gray-500">#{item.itemNumber}</span> {item.description}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">
            {item.quantity.toLocaleString()} {item.unit}
            {item.pageReference && t('draftView.itemUnitSep', { ref: item.pageReference })}
          </p>
          {hasPrice && (
            <p className="mt-1 text-xs text-gray-700">
              <span className="font-medium">
                {formatUSD(item.estimatedUnitPriceCents ?? 0)} / {item.unit}
              </span>
              {lineCents !== undefined && (
                <span className="text-gray-500"> · line {formatUSD(lineCents)}</span>
              )}
              {item.priceSourceConfidence && (
                <span className="ml-2 align-middle">
                  <PriceSourcePill value={item.priceSourceConfidence} />
                </span>
              )}
            </p>
          )}
          {item.priceSourceNote && (
            <p className="mt-1 text-xs italic text-gray-500">
              <span className="font-medium not-italic text-gray-600">Price source:</span>{' '}
              {item.priceSourceNote}
            </p>
          )}
          {item.notes && <p className="mt-1 text-xs italic text-gray-500">{item.notes}</p>}
        </div>
        <ConfidencePill value={item.confidence} />
      </div>
    </li>
  );
}

/** Grand-total row at the bottom of the bid items list. Renders nothing
 *  when the draft has no priced items (older drafts, T&M-only jobs). */
function BidTotalRow({ draft }: { draft: PtoEOutput }) {
  // Prefer the model-emitted total when present; otherwise sum what's
  // there. Older drafts that don't have prices return 0, which we hide.
  const grand = draft.estimatedBidTotalCents ?? sumPtoEBidTotalCents(draft.bidItems);
  if (grand <= 0) return null;
  return (
    <div className="mt-3 flex items-baseline justify-between border-t border-gray-200 pt-3">
      <span className="text-sm font-semibold uppercase tracking-wide text-gray-700">
        Estimated bid total
      </span>
      <span className="text-lg font-semibold text-gray-900">{formatUSD(grand)}</span>
    </div>
  );
}

/** Small pill explaining how confident the AI is in the PRICE (not the
 *  quantity). Visually distinct from ConfidencePill — uses a muted
 *  outline so the two pills don't compete. */
function PriceSourcePill({ value }: { value: PtoEItemConfidence }) {
  const styles: Record<PtoEItemConfidence, string> = {
    HIGH: 'border-green-300 text-green-700',
    MEDIUM: 'border-yellow-300 text-yellow-700',
    LOW: 'border-red-300 text-red-700',
  };
  const label: Record<PtoEItemConfidence, string> = {
    HIGH: 'Local comparable',
    MEDIUM: 'CA regional avg',
    LOW: 'Generic',
  };
  return (
    <span
      className={`inline-block rounded-full border bg-white px-1.5 py-0.5 text-[10px] font-medium ${styles[value]}`}
      title={`Price source confidence: ${value}`}
    >
      {label[value]}
    </span>
  );
}

export function ConfidencePill({ value }: { value: PtoEItemConfidence }) {
  const styles: Record<PtoEItemConfidence, string> = {
    HIGH: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-red-100 text-red-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[value]}`}
    >
      {value}
    </span>
  );
}
