'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import { mondayOfWeek, type CertifiedPayroll, type Job } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

function sundayOfWeek(monday: string): string {
  const d = new Date(monday + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return monday;
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export default function NewCprPage() {
  const t = useTranslator();
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
      setError(t('newCpr.errPickJob'));
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
      if (err instanceof ApiError) setError(t('newCpr.errHttp', { msg: err.message, status: err.status }));
      else if (err instanceof Error) setError(err.message);
      else setError(t('newCpr.errUnknown'));
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/certified-payrolls" className="text-sm text-yge-blue-500 hover:underline">
          {t('newCpr.back')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newCpr.title')}</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('newCpr.lblJob')}>
          <select
            required
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('newCpr.pickJob')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('newCpr.lblWeekStarting')}>
          <input
            type="date"
            value={weekStarting}
            onChange={(e) => setWeekStarting(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('newCpr.weekHint')}
          </p>
        </Field>
        <Field label={t('newCpr.lblPayrollNumber')}>
          <input
            type="number"
            min="1"
            value={payrollNumber}
            onChange={(e) => setPayrollNumber(e.target.value)}
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
            {saving ? t('newCpr.busy') : t('newCpr.action')}
          </button>
          <Link href="/certified-payrolls" className="text-sm text-gray-600 hover:underline">
            {t('newCpr.cancel')}
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
