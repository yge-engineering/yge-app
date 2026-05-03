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

import { Alert, AppShell } from '../../components';
import { useSearchParams } from 'next/navigation';
import type { Job, PtoEOutput } from '@yge/shared';
import { ApiError, getJson, postJson } from '@/lib/api';
import { DraftView } from '@/components/draft-view';
import { useTranslator } from '@/lib/use-translator';

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

export default function PlansToEstimatePage() {
  const searchParams = useSearchParams();
  const preselectedJobId = searchParams.get('jobId') ?? '';
  const t = useTranslator();

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
      setError(t('pte.errors.pickJob'));
      return;
    }
    if (documentText.trim().length < 20) {
      setError(t('pte.errors.tooShort'));
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
          <div className="flex items-center gap-3">
            <Link href="/plans-to-estimate/multipass" className="text-sm text-yge-blue-500 hover:underline">
              {t('pte.multipassLink')}
            </Link>
            <Link href="/drafts" className="text-sm text-yge-blue-500 hover:underline">
              {t('pte.draftsLink')}
            </Link>
          </div>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-yge-blue-500">{t('pte.title')}</h1>
        <p className="mt-2 text-gray-700">{t('pte.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div>
            <label htmlFor="job" className="block text-sm font-semibold text-gray-700">
              {t('pte.label.job')}
            </label>
            {jobs === null ? (
              <p className="mt-1 text-xs text-gray-500">{t('pte.loadingJobs')}</p>
            ) : jobs.length === 0 ? (
              <p className="mt-1 text-sm text-gray-700">
                {t('pte.noJobsPrefix')}
                <Link
                  href="/jobs/new"
                  className="text-yge-blue-500 hover:underline"
                >
                  {t('pte.noJobsLink')}
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
                  {t('pte.driftHint')}
                  <Link
                    href="/jobs/new"
                    className="text-yge-blue-500 hover:underline"
                  >
                    {t('pte.newJobLink')}
                  </Link>
                </p>
              </>
            )}
            {jobsError && (
              <p className="mt-1 text-xs text-red-700">
                {t('pte.jobsError', { message: jobsError })}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="doc" className="block text-sm font-semibold text-gray-700">
              {t('pte.label.documentText')}
            </label>
            <textarea
              id="doc"
              value={documentText}
              onChange={(e) => setDocumentText(e.target.value)}
              placeholder={t('pte.placeholder')}
              className="mt-1 h-96 w-full rounded border border-gray-300 p-3 font-mono text-xs"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('pte.docCharCount', { count: documentText.length.toLocaleString() })}
            </p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-gray-700">
              {t('pte.label.notes')}
            </label>
            <textarea
              id="notes"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder={t('pte.notesPlaceholder')}
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
            {loading ? t('pte.btn.generating') : t('pte.btn.generate')}
          </button>

          {error && <Alert tone="danger">{error}</Alert>}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {!result && !loading && (
            <p className="text-sm text-gray-500">
              {t('pte.placeholder.right')}
            </p>
          )}
          {loading && (
            <p className="text-sm text-gray-700">
              {t('pte.loadingRight')}
            </p>
          )}
          {result && (
            <>
              {result.savedId && (
                <p className="mb-3 text-xs text-gray-500">
                  {t('pte.savedToHistory')}
                  <Link
                    href={`/drafts/${result.savedId}`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    {t('pte.openDraftLink')}
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
