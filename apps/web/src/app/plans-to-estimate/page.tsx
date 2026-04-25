'use client';

// Plans-to-Estimate page — paste RFP / spec text, get back a draft estimate.
//
// Phase 1 MVP. Future iterations will:
//   - Accept PDF / image upload + run OCR server-side
//   - Tie to a real Job (and persist the draft as an Estimate row)
//   - Stream the response token-by-token instead of waiting for the full call
//
// For now: client component, calls the Express API directly (CORS already
// allowed for localhost:3000). State is local-only; refresh wipes it.

import { useState } from 'react';
import Link from 'next/link';
import type { PtoEOutput, PtoEBidItem, PtoEItemConfidence } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

interface ApiResult {
  jobId: string;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  draft: PtoEOutput;
}

const SAMPLE_PLACEHOLDER = `Paste the full RFP, plan-set notes, or bid schedule here.

Example sources:
  • Bid schedule from Section 00 of a public works RFP
  • Specification text exported from Bluebeam / Adobe
  • Engineer's estimate of probable cost
  • Plan-set callouts pasted in (one item per line works)

The AI will read it and draft a bid item list with quantities, units, and
flagged uncertainties. You review and refine before submitting.`;

// Generate a temporary cuid-like id for the jobId field. The real job-creation
// flow comes later; the API still requires a cuid-shaped string today.
function makeTempJobId(): string {
  // Real cuid format starts with "c" and is ~25 chars. Random alpha is fine.
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'c';
  for (let i = 0; i < 24; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// CSV helpers — let Ryan paste the AI's draft straight into the Excel job-cost
// sheet he's already using. RFC 4180: wrap any field containing comma, quote,
// CR, or LF in double quotes, and double up internal quotes.

const CSV_HEADERS = [
  'Item #',
  'Description',
  'Unit',
  'Quantity',
  'Confidence',
  'Page Reference',
  'Notes',
];

function csvEscape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function bidItemsToCsv(items: PtoEBidItem[]): string {
  const rows: string[] = [CSV_HEADERS.map(csvEscape).join(',')];
  for (const item of items) {
    rows.push(
      [
        item.itemNumber,
        item.description,
        item.unit,
        item.quantity,
        item.confidence,
        item.pageReference ?? '',
        item.notes ?? '',
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  // Excel handles \r\n cleanly. Trailing newline is conventional.
  return rows.join('\r\n') + '\r\n';
}

function safeFilename(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return (slug || 'draft-estimate') + '-bid-items.csv';
}

export default function PlansToEstimatePage() {
  const [documentText, setDocumentText] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  async function handleGenerate() {
    setError(null);
    setResult(null);
    setElapsedMs(null);
    if (documentText.trim().length < 20) {
      setError('Document text is too short — paste at least a couple of paragraphs.');
      return;
    }

    setLoading(true);
    const start = Date.now();
    try {
      const res = await postJson<ApiResult>('/api/plans-to-estimate', {
        jobId: makeTempJobId(),
        documentText,
        sessionNotes: sessionNotes.trim() || undefined,
      });
      setResult(res);
      setElapsedMs(Date.now() - start);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-yge-blue-500">Plans-to-Estimate</h1>
        <p className="mt-2 text-gray-700">
          Paste an RFP, spec, or plan-set excerpt below. The AI drafts a bid item list — you
          review, adjust, and use it as the starting point for the real estimate.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div>
            <label htmlFor="doc" className="block text-sm font-semibold text-gray-700">
              Document text
            </label>
            <textarea
              id="doc"
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              placeholder={SAMPLE_PLACEHOLDER}
              className="mt-1 h-96 w-full rounded border border-gray-300 p-3 font-mono text-xs"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              {documentText.length.toLocaleString()} characters
            </p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-gray-700">
              Notes for the estimator (optional)
            </label>
            <textarea
              id="notes"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Mandatory site walk Tuesday 4/28; assume CAL FIRE prevailing wage; hauling self-performed."
              className="mt-1 h-24 w-full rounded border border-gray-300 p-3 text-sm"
              disabled={loading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || documentText.trim().length === 0}
            className="rounded bg-yge-blue-500 px-6 py-3 text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Generating draft… (30-90s)' : 'Generate Draft Estimate'}
          </button>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {!result && !loading && (
            <p className="text-sm text-gray-500">
              The draft estimate appears here once you click Generate.
            </p>
          )}
          {loading && (
            <p className="text-sm text-gray-700">
              Reading the document and drafting the estimate. This typically takes 30-90 seconds for
              a typical RFP.
            </p>
          )}
          {result && (
            <DraftView
              draft={result.draft}
              modelUsed={result.modelUsed}
              promptVersion={result.promptVersion}
              usage={result.usage}
              elapsedMs={elapsedMs}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function DraftView({
  draft,
  modelUsed,
  promptVersion,
  usage,
  elapsedMs,
}: {
  draft: PtoEOutput;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  elapsedMs: number | null;
}) {
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
          {draft.location && <> · {draft.location}</>}
          {draft.ownerAgency && <> · {draft.ownerAgency}</>}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
          {draft.bidDueDate && (
            <>
              <dt className="font-medium">Bid due</dt>
              <dd>{draft.bidDueDate}</dd>
            </>
          )}
          {draft.prebidMeeting && (
            <>
              <dt className="font-medium">Pre-bid</dt>
              <dd>{draft.prebidMeeting}</dd>
            </>
          )}
          <dt className="font-medium">Overall confidence</dt>
          <dd>
            <ConfidencePill value={draft.overallConfidence} />
          </dd>
        </dl>
      </header>

      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bid items</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="rounded border border-yge-blue-500 px-3 py-1 text-xs font-medium text-yge-blue-700 hover:bg-yge-blue-100"
              title="Download all bid items as a CSV file you can open in Excel"
            >
              Download CSV
            </button>
            <button
              onClick={handleCopyCsv}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title="Copy CSV text to clipboard — paste straight into Excel"
            >
              {copyState === 'copied'
                ? 'Copied!'
                : copyState === 'error'
                  ? 'Copy failed'
                  : 'Copy CSV'}
            </button>
          </div>
        </div>
        <ul className="mt-2 divide-y divide-gray-100">
          {draft.bidItems.map((item, i) => (
            <BidItemRow key={i} item={item} />
          ))}
        </ul>
      </div>

      {draft.assumptions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Assumptions
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
            Open questions
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {draft.questionsForEstimator.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="border-t border-gray-100 pt-3 text-xs text-gray-400">
        Model: {modelUsed} · Prompt: {promptVersion} ·{' '}
        {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out tokens
        {elapsedMs != null && <> · {(elapsedMs / 1000).toFixed(1)}s</>}
      </footer>
    </div>
  );
}

function BidItemRow({ item }: { item: PtoEBidItem }) {
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">
            <span className="text-gray-500">#{item.itemNumber}</span> {item.description}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">
            {item.quantity.toLocaleString()} {item.unit}
            {item.pageReference && <> · {item.pageReference}</>}
          </p>
          {item.notes && <p className="mt-1 text-xs italic text-gray-500">{item.notes}</p>}
        </div>
        <ConfidencePill value={item.confidence} />
      </div>
    </li>
  );
}

function ConfidencePill({ value }: { value: PtoEItemConfidence }) {
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
