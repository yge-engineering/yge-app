'use client';

// /daily-reports/new — minimal create form. Date + job + foreman, then on
// save we jump to the edit page where the foreman fills in crew rows + the
// scope-completed / issues / next-day-plan text fields.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import {
  fullName,
  type DailyReport,
  type Employee,
  type Job,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

export default function NewDailyReportPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobId, setJobId] = useState('');
  const [foremanId, setForemanId] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [foremen, setForemen] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    Promise.all([
      fetch(`${apiBase}/api/jobs`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { jobs: [] }))
        .then((j: { jobs: Job[] }) => j.jobs ?? []),
      fetch(`${apiBase}/api/employees`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { employees: [] }))
        .then((j: { employees: Employee[] }) =>
          (j.employees ?? []).filter(
            (e) =>
              e.status === 'ACTIVE' &&
              (e.role === 'FOREMAN' || e.role === 'SUPERINTENDENT'),
          ),
        ),
    ])
      .then(([js, fs]) => {
        setJobs(js);
        setForemen(fs);
        if (js[0]) setJobId(js[0].id);
        if (fs[0]) setForemanId(fs[0].id);
      })
      .catch(() => {
        // Silent failure — empty dropdowns let the user know.
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!jobId) {
      setError(t('dailyReportNew.error.pickJob'));
      return;
    }
    if (foremanId.trim().length === 0) {
      setError(t('dailyReportNew.error.pickForeman'));
      return;
    }
    setSaving(true);
    try {
      const res = await postJson<{ report: DailyReport }>('/api/daily-reports', {
        date,
        jobId,
        foremanId,
      });
      router.push(`/daily-reports/${res.report.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('dailyReportNew.error.unknown'));
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <Link
          href="/daily-reports"
          className="text-sm text-yge-blue-500 hover:underline"
        >
          {t('dailyReportDetail.backLink')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('dailyReportNew.title')}</h1>
      <p className="mt-2 text-gray-700">{t('dailyReportNew.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('dailyReportNew.field.date')}>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('dailyReportNew.field.job')}>
          <select
            required
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('dailyReportNew.option.pickJob')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
                {j.location ? ` (${j.location})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('dailyReportNew.field.foreman')}>
          <select
            required
            value={foremanId}
            onChange={(e) => setForemanId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('dailyReportNew.option.pickForeman')}</option>
            {foremen.map((f) => (
              <option key={f.id} value={f.id}>
                {fullName(f)}
              </option>
            ))}
          </select>
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
            {saving ? t('dailyReportNew.btn.saving') : t('dailyReportNew.btn.create')}
          </button>
          <Link
            href="/daily-reports"
            className="text-sm text-gray-600 hover:underline"
          >
            {t('dailyReportNew.btn.cancel')}
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
