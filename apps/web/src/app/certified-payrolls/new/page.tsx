'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mondayOfWeek, type CertifiedPayroll, type Job } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

function sundayOfWeek(monday: string): string {
  const d = new Date(monday + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return monday;
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export default function NewCprPage() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [weekStarting, setWeekStarting] = useState(mondayOfWeek(new Date().toISOString().slice(0, 10)));
  const [payrollNumber, setPayrollNumber] = useState('1');
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
    const week = mondayOfWeek(weekStarting);
    setSaving(true);
    try {
      const job = jobs.find((j) => j.id === jobId);
      const res = await postJson<{ certifiedPayroll: CertifiedPayroll }>(
        '/api/certified-payrolls',
        {
          jobId,
          weekStarting: week,
          weekEnding: sundayOfWeek(week),
          payrollNumber: Number(payrollNumber || '1'),
          projectNumber: job?.projectName ?? undefined,
          awardingAgency: job?.ownerAgency ?? undefined,
        },
      );
      router.push(`/certified-payrolls/${res.certifiedPayroll.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (HTTP ${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError('Unknown error');
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/certified-payrolls" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to CPRs
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">New certified payroll</h1>

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
        <Field label="Week starting (Monday)">
          <input
            type="date"
            value={weekStarting}
            onChange={(e) => setWeekStarting(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Will snap to Monday automatically. Sunday end-date is computed.
          </p>
        </Field>
        <Field label="Payroll number">
          <input
            type="number"
            min="1"
            value={payrollNumber}
            onChange={(e) => setPayrollNumber(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
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
            {saving ? 'Saving…' : 'Create CPR'}
          </button>
          <Link href="/certified-payrolls" className="text-sm text-gray-600 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </main>
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
