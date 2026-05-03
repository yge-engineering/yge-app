'use client';

// /jobs/new — create a new job. After save, jump straight to its detail page
// so the estimator can immediately kick off Plans-to-Estimate against it.

import { useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import {
  contractTypeLabel,
  statusLabel,
  type Job,
  type JobContractType,
  type JobStatus,
  type PtoEProjectType,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

const PROJECT_TYPES: PtoEProjectType[] = [
  'ROAD_RECONSTRUCTION',
  'DRAINAGE',
  'BRIDGE',
  'GRADING',
  'FIRE_FUEL_REDUCTION',
  'OTHER',
];

const CONTRACT_TYPES: JobContractType[] = [
  'PUBLIC_WORKS',
  'PRIVATE',
  'TASK_ORDER',
  'NEGOTIATED',
  'OTHER',
];

const STATUSES: JobStatus[] = [
  'PROSPECT',
  'PURSUING',
  'BID_SUBMITTED',
  'AWARDED',
  'LOST',
  'NO_BID',
  'ARCHIVED',
];

function projectTypeLabel(t: PtoEProjectType): string {
  return t
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FormState {
  projectName: string;
  projectType: PtoEProjectType;
  contractType: JobContractType;
  status: JobStatus;
  ownerAgency: string;
  location: string;
  bidDueDate: string;
  engineersEstimateDollars: string; // string-typed for the number input
  pursuitOwner: string;
  notes: string;
}

const INITIAL: FormState = {
  projectName: '',
  projectType: 'ROAD_RECONSTRUCTION',
  contractType: 'PUBLIC_WORKS',
  status: 'PURSUING',
  ownerAgency: '',
  location: '',
  bidDueDate: '',
  engineersEstimateDollars: '',
  pursuitOwner: '',
  notes: '',
};

export default function NewJobPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.projectName.trim().length === 0) {
      setError(t('jobNew.error.projectNameRequired'));
      return;
    }

    // Convert dollars → cents only if the field is filled.
    let engineersEstimateCents: number | undefined;
    if (form.engineersEstimateDollars.trim().length > 0) {
      const n = Number(form.engineersEstimateDollars);
      if (!Number.isFinite(n) || n < 0) {
        setError(t('jobNew.error.estimateNonNegative'));
        return;
      }
      engineersEstimateCents = Math.round(n * 100);
    }

    const body = {
      projectName: form.projectName.trim(),
      projectType: form.projectType,
      contractType: form.contractType,
      status: form.status,
      ...(form.ownerAgency.trim() ? { ownerAgency: form.ownerAgency.trim() } : {}),
      ...(form.location.trim() ? { location: form.location.trim() } : {}),
      ...(form.bidDueDate.trim() ? { bidDueDate: form.bidDueDate.trim() } : {}),
      ...(engineersEstimateCents !== undefined ? { engineersEstimateCents } : {}),
      ...(form.pursuitOwner.trim() ? { pursuitOwner: form.pursuitOwner.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    setSaving(true);
    try {
      const res = await postJson<{ job: Job }>('/api/jobs', body);
      router.push(`/jobs/${res.job.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('jobNew.error.unknown'));
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/jobs" className="text-sm text-yge-blue-500 hover:underline">
          {t('jobDetail.backLink')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('jobNew.title')}</h1>
      <p className="mt-2 text-gray-700">{t('jobNew.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="projectName" className="block text-sm font-semibold text-gray-700">
            {t('jobNew.field.projectName')} <span className="text-red-600">*</span>
          </label>
          <input
            id="projectName"
            type="text"
            value={form.projectName}
            onChange={(e) => update('projectName', e.target.value)}
            placeholder={t('jobNew.placeholder.projectName')}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            disabled={saving}
            required
            maxLength={200}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="projectType" className="block text-sm font-semibold text-gray-700">
              {t('jobNew.field.projectType')}
            </label>
            <select
              id="projectType"
              value={form.projectType}
              onChange={(e) => update('projectType', e.target.value as PtoEProjectType)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              disabled={saving}
            >
              {PROJECT_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {projectTypeLabel(pt)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="contractType" className="block text-sm font-semibold text-gray-700">
              {t('jobNew.field.contractType')}
            </label>
            <select
              id="contractType"
              value={form.contractType}
              onChange={(e) =>
                update('contractType', e.target.value as JobContractType)
              }
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              disabled={saving}
            >
              {CONTRACT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {contractTypeLabel(ct)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-semibold text-gray-700">
            {t('jobNew.field.status')}
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => update('status', e.target.value as JobStatus)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            disabled={saving}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ownerAgency" className="block text-sm font-semibold text-gray-700">
              {t('jobNew.field.ownerAgency')}
            </label>
            <input
              id="ownerAgency"
              type="text"
              value={form.ownerAgency}
              onChange={(e) => update('ownerAgency', e.target.value)}
              placeholder={t('jobNew.placeholder.ownerAgency')}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              disabled={saving}
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-semibold text-gray-700">
              {t('jobNew.field.location')}
            </label>
            <input
              id="location"
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder={t('jobNew.placeholder.location')}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              disabled={saving}
              maxLength={200}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bidDueDate" className="block text-sm font-semibold text-gray-700">
              {t('jobNew.field.bidDueDate')}
            </label>
            <input
              id="bidDueDate"
              type="text"
              value={form.bidDueDate}
              onChange={(e) => update('bidDueDate', e.target.value)}
              placeholder={t('jobNew.placeholder.bidDueDate')}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              disabled={saving}
              maxLength={40}
            />
            <p className="mt-1 text-xs text-gray-500">{t('jobNew.hint.bidDueDate')}</p>
          </div>

          <div>
            <label
              htmlFor="engineersEstimateDollars"
              className="block text-sm font-semibold text-gray-700"
            >
              {t('jobNew.field.engineersEstimate')}
            </label>
            <input
              id="engineersEstimateDollars"
              type="number"
              min="0"
              step="0.01"
              value={form.engineersEstimateDollars}
              onChange={(e) => update('engineersEstimateDollars', e.target.value)}
              placeholder={t('jobNew.placeholder.engineersEstimate')}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-gray-500">{t('jobNew.hint.engineersEstimate')}</p>
          </div>
        </div>

        <div>
          <label htmlFor="pursuitOwner" className="block text-sm font-semibold text-gray-700">
            {t('jobNew.field.pursuitOwner')}
          </label>
          <input
            id="pursuitOwner"
            type="text"
            value={form.pursuitOwner}
            onChange={(e) => update('pursuitOwner', e.target.value)}
            placeholder={t('jobNew.placeholder.pursuitOwner')}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            disabled={saving}
            maxLength={120}
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-semibold text-gray-700">
            {t('jobNew.field.notes')}
          </label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder={t('jobNew.placeholder.notes')}
            className="mt-1 h-32 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            disabled={saving}
            maxLength={10000}
          />
        </div>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-6 py-3 font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t('jobNew.btn.saving') : t('jobNew.btn.create')}
          </button>
          <Link
            href="/jobs"
            className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
          >
            {t('jobNew.btn.cancel')}
          </Link>
        </div>
      </form>
    </main>
    </AppShell>
  );
}
