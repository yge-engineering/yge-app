'use client';

// /bid-results/new — minimal create form. Pick the job + the bid-open
// date, save. The detail page handles bidder rows + outcome.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import type { BidResult, Job } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

export default function NewBidResultPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [bidOpenedAt, setBidOpenedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs: Job[] }) => {
        setJobs(j.jobs ?? []);
        if (j.jobs?.[0]) setJobId(j.jobs[0].id);
      })
      .catch(() => setJobs([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!jobId) {
      setError('Pick a job.');
      return;
    }
    setSaving(true);
    try {
      const res = await postJson<{ result: BidResult }>('/api/bid-results', {
        jobId,
        bidOpenedAt,
      });
      router.push(`/bid-results/${res.result.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/bid-results" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to bid results
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Log a bid result</h1>
      <p className="mt-2 text-gray-700">
        Pick the job and the date the agency opened bids. After saving you can
        paste in the bidder list, mark the apparent low, and set the outcome.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Job *">
          <select
            required
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— Pick a job —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
                {j.location ? ` (${j.location})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bid-open date *">
          <input
            required
            type="date"
            value={bidOpenedAt}
            onChange={(e) => setBidOpenedAt(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create draft'}
          </button>
          <Link href="/bid-results" className="text-sm text-gray-600 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
