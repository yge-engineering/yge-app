'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import type { ArInvoice, Job } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

export default function NewArInvoicePage() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs: Job[] }) => {
        setJobs(j.jobs ?? []);
        if (j.jobs?.[0]) {
          setJobId(j.jobs[0].id);
          setCustomerName(j.jobs[0].ownerAgency ?? '');
        }
      })
      .catch(() => setJobs([]));
  }, []);

  function pickJob(id: string) {
    setJobId(id);
    const j = jobs.find((x) => x.id === id);
    if (j?.ownerAgency) setCustomerName(j.ownerAgency);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!jobId || !customerName.trim() || !invoiceNumber.trim()) {
      setError(t('arInvoiceNew.error.required'));
      return;
    }
    setSaving(true);
    try {
      const res = await postJson<{ invoice: ArInvoice }>('/api/ar-invoices', {
        jobId,
        customerName: customerName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
      });
      router.push(`/ar-invoices/${res.invoice.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (HTTP ${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError(t('arInvoiceNew.error.unknown'));
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/ar-invoices" className="text-sm text-yge-blue-500 hover:underline">
          {t('arInvoiceDetail.backLink')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('arInvoiceNew.title')}</h1>
      <p className="mt-2 text-gray-700">{t('arInvoiceNew.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('arInvoiceNew.field.job')}>
          <select
            required
            value={jobId}
            onChange={(e) => pickJob(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('arInvoiceNew.option.pickJob')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('arInvoiceNew.field.customer')}>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder={t('arInvoiceNew.placeholder.customer')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('arInvoiceNew.field.invoiceNumber')}>
            <input
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder={t('arInvoiceNew.placeholder.invoiceNumber')}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </Field>
          <Field label={t('arInvoiceNew.field.invoiceDate')}>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? t('arInvoiceNew.btn.saving') : t('arInvoiceNew.btn.create')}
          </button>
          <Link href="/ar-invoices" className="text-sm text-gray-600 hover:underline">
            {t('arInvoiceNew.btn.cancel')}
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
