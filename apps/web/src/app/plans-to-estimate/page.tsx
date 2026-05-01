'use client';

// Plans-to-Estimate page — paste RFP / spec text, get back a draft estimate.
//
// Phase 1 MVP. Future iterations will:
//   - Accept PDF / image upload + run OCR server-side
//   - Tie to a real Job (and persist the draft as an Estimate row)
//   - Stream the response token-by-token instead of waiting for the full call
//
// Each successful run is auto-saved by the API to the drafts history, so
// estimators can re-open prior runs from /drafts without paying Anthropic
// again to redraft the same RFP.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import { useSearchParams } from 'next/navigation';
import type { Job, PtoEOutput } from '@yge/shared';
import { ApiError, getJson, postJson } from '@/lib/api';
import { DraftView } from '@/components/draft-view';

interface ApiResult {
  jobId: string;
  /** Set when the API successfully persisted the draft to history. */
  savedId?: string;
  modelUsed: string;
  promptVersion: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs?: number;
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

export default function PlansToEstimatePage() {
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId') ?? '';

  const [documentText, setDocumentText] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  // Job picker — populates from /api/jobs on mount. If the URL has ?jobId=, we
  // pre-select that one. Otherwise the estimator picks from the dropdown.
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>(preselectedJobId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getJson<{ jobs: Job[] }>('/api/jobs');
        if (cancelled) return;
        setJobs(res.jobs);
        // If nothing pre-selected, default to the first job in the list (the
        // newest one) so the dropdown isn't empty.
        const firstJob = res.jobs[0];
        if (!preselectedJobId && firstJob) {
          setSelectedJobId(firstJob.id);
        }
      } catch (err) {
        if (cancelled) return;
        setJobsError(err instanceof Error ? err.message : 'Unknown error');
        setJobs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preselectedJobId]);

  async function handleGenerate() {
    setError(null);
    setResult(null);
    setElapsedMs(null);
    if (!selectedJobId) {
      setError(
        'Pick a job first. Create one on the Jobs page if you don\u2019t have one yet.',
      );
      return;
    }
    if (documentText.trim().length < 20) {
      setError('Document text is too short — paste at least a couple of paragraphs.');
      return;
    }

    setLoading(true);
    const start = Date.now();
    try {
      const res = await postJson<ApiResult>('/api/plans-to-estimate', {
        jobId: selectedJobId,
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
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Home
          </Link>
          <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
            View saved drafts &rarr;
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-yge-blue-500">Plans-to-Estimate</h1>
        <p className="mt-2 text-gray-700">
          Paste an RFP, spec, or plan-set excerpt below. The AI drafts a bid item list — you
          review, adjust, and use it as the starting point for the real estimate.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div>
            <label htmlFor="job" className="block text-sm font-semibold text-gray-700">
              Job
            </label>
            {jobs === null ? (
              <p className="mt-1 text-xs text-gray-500">Loading jobs&hellip;</p>
            ) : jobs.length === 0 ? (
              <p className="mt-1 text-sm text-gray-700">
                No jobs yet.{' '}
                <Link
                  href="/jobs/new"
                  className="text-yge-blue-500 hover:underline"
                >
                  Create one first &rarr;
                </Link>
              </p>
            ) : (
              <>
                <select
                  id="job"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  disabled={loading}
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.projectName}
                      {j.ownerAgency ? ` — ${j.ownerAgency}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Drafts are saved against the selected job.{' '}
                  <Link
                    href="/jobs/new"
                    className="text-yge-blue-500 hover:underline"
                  >
                    + new job
                  </Link>
                </p>
              </>
            )}
            {jobsError && (
              <p className="mt-1 text-xs text-red-700">
                Couldn&rsquo;t load jobs: {jobsError}
              </p>
            )}
          </div>

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
            disabled={
              loading || documentText.trim().length === 0 || !selectedJobId
            }
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
            <>
              {result.savedId && (
                <p className="mb-3 text-xs text-gray-500">
                  Saved to history.{' '}
                  <Link
                    href={`/drafts/${result.savedId}`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    Open this draft directly &rarr;
                  </Link>
                </p>
              )}
              <DraftView
                draft={result.draft}
                modelUsed={result.modelUsed}
                promptVersion={result.promptVersion}
                usage={result.usage}
                elapsedMs={elapsedMs}
              />
            </>
          )}
        </section>
      </div>
    </main>
    </AppShell>
  );
}
