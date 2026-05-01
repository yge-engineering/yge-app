'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { useRouter } from 'next/navigation';
import {
  submittalKindLabel,
  type Job,
  type Submittal,
  type SubmittalKind,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

const KINDS: SubmittalKind[] = [
  'SHOP_DRAWING',
  'PRODUCT_DATA',
  'SAMPLE',
  'CERTIFICATE',
  'METHOD_STATEMENT',
  'MIX_DESIGN',
  'OPERATIONS_MANUAL',
  'WARRANTY',
  'OTHER',
];

export default function NewSubmittalPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [submittalNumber, setSubmittalNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [kind, setKind] = useState<SubmittalKind>('SHOP_DRAWING');
  const [specSection, setSpecSection] = useState('');
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
    if (!jobId || !submittalNumber.trim() || !subject.trim()) {
      setError('Job, number, and subject are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await postJson<{ submittal: Submittal }>('/api/submittals', {
        jobId,
        submittalNumber: submittalNumber.trim(),
        subject: subject.trim(),
        kind,
        ...(specSection.trim() ? { specSection: specSection.trim() } : {}),
      });
      router.push(`/submittals/${res.submittal.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (HTTP ${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError('Unknown error');
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/submittals" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to submittals
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">New submittal</h1>

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
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Submittal number *">
            <input
              required
              value={submittalNumber}
              onChange={(e) => setSubmittalNumber(e.target.value)}
              placeholder="03 30 00-1"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </Field>
          <Field label="Kind">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SubmittalKind)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {submittalKindLabel(k)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Subject *">
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder='e.g. "30,000 PSI mix design"'
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Spec section">
          <input
            value={specSection}
            onChange={(e) => setSpecSection(e.target.value)}
            placeholder="03 30 00 - Cast-in-Place Concrete"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create submittal'}
          </button>
          <Link href="/submittals" className="text-sm text-gray-600 hover:underline">
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
