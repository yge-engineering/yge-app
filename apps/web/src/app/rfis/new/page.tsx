'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import type { Job, Rfi } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

export default function NewRfiPage() {
  const t = useTranslator();
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [rfiNumber, setRfiNumber] = useState('');
  const [subject, setSubject] = useState('');
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
    if (!jobId || !rfiNumber.trim() || !subject.trim()) {
      setError(t('newRfi.errRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await postJson<{ rfi: Rfi }>('/api/rfis', {
        jobId,
        rfiNumber: rfiNumber.trim(),
        subject: subject.trim(),
      });
      router.push(`/rfis/${res.rfi.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(t('newRfi.errHttp', { msg: err.message, status: err.status }));
      else if (err instanceof Error) setError(err.message);
      else setError(t('newRfi.errUnknown'));
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/rfis" className="text-sm text-yge-blue-500 hover:underline">
          {t('newRfi.back')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newRfi.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newRfi.subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('newRfi.lblJob')}>
          <select
            required
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('newRfi.pickJob')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('newRfi.lblNumber')}>
          <input
            required
            value={rfiNumber}
            onChange={(e) => setRfiNumber(e.target.value)}
            placeholder="14"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label={t('newRfi.lblSubject')}>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('newRfi.phSubject')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
            {saving ? t('newRfi.busy') : t('newRfi.action')}
          </button>
          <Link href="/rfis" className="text-sm text-gray-600 hover:underline">
            {t('newRfi.cancel')}
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
