'use client';

// /ap-invoices/new — minimal create form. After save, jump to the edit
// page where line items + payment + approval workflow live.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import type { ApInvoice, Job } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

export default function NewApInvoicePage() {
  const router = useRouter();
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState('');
  const [jobId, setJobId] = useState('');
  const [totalDollars, setTotalDollars] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs: Job[] }) => setJobs(j.jobs ?? []))
      .catch(() => setJobs([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (vendorName.trim().length === 0) {
      setError(t('apInvoiceNew.error.vendorRequired'));
      return;
    }
    let totalCents = 0;
    if (totalDollars.trim().length > 0) {
      const n = Number(totalDollars);
      if (!Number.isFinite(n) || n < 0) {
        setError(t('apInvoiceNew.error.totalNonNegative'));
        return;
      }
      totalCents = Math.round(n * 100);
    }
    setSaving(true);
    try {
      const res = await postJson<{ invoice: ApInvoice }>('/api/ap-invoices', {
        vendorName: vendorName.trim(),
        invoiceDate,
        ...(invoiceNumber.trim() ? { invoiceNumber: invoiceNumber.trim() } : {}),
        ...(dueDate.trim() ? { dueDate: dueDate.trim() } : {}),
        ...(jobId ? { jobId } : {}),
        totalCents,
      });
      router.push(`/ap-invoices/${res.invoice.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('apInvoiceNew.error.unknown'));
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <Link href="/ap-invoices" className="text-sm text-yge-blue-500 hover:underline">
          {t('apInvoiceDetail.backLink')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('apInvoiceNew.title')}</h1>
      <p className="mt-2 text-gray-700">{t('apInvoiceNew.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('apInvoiceNew.field.vendor')}>
          <input
            required
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder={t('apInvoiceNew.placeholder.vendor')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('apInvoiceNew.field.invoiceNumber')}>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder={t('apInvoiceNew.placeholder.invoiceNumber')}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </Field>
          <Field label={t('apInvoiceNew.field.job')}>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">{t('apInvoiceNew.option.notJobSpecific')}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.projectName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('apInvoiceNew.field.invoiceDate')}>
            <input
              required
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('apInvoiceNew.field.dueDate')}>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('apInvoiceNew.field.total')}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalDollars}
              onChange={(e) => setTotalDollars(e.target.value)}
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
            {saving ? t('apInvoiceNew.btn.saving') : t('apInvoiceNew.btn.save')}
          </button>
          <Link href="/ap-invoices" className="text-sm text-gray-600 hover:underline">
            {t('apInvoiceNew.btn.cancel')}
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
