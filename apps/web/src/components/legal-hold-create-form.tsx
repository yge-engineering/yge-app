// Create-legal-hold form. POSTs /api/legal-holds.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LegalHoldReason } from '@yge/shared';
import { useTranslator } from '../lib/use-translator';

interface Props {
  apiBaseUrl: string;
}

const REASONS: LegalHoldReason[] = [
  'AGENCY_AUDIT',
  'IRS_AUDIT',
  'WORKERS_COMP_AUDIT',
  'PAGA_CLAIM',
  'WAGE_HOUR_CLAIM',
  'CONTRACT_DISPUTE',
  'CONSTRUCTION_DEFECT',
  'WARRANTY_CLAIM',
  'INTERNAL_INVESTIGATION',
  'OTHER',
];

export function LegalHoldCreateForm({ apiBaseUrl }: Props) {
  const router = useRouter();
  const t = useTranslator();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState<LegalHoldReason>('CONTRACT_DISPUTE');
  const [entityType, setEntityType] = useState('Job');
  const [entityId, setEntityId] = useState('');
  const [matterDate, setMatterDate] = useState(new Date().toISOString().slice(0, 10));
  const [matterNumber, setMatterNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = title.trim().length > 0 && entityId.trim().length > 0;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/legal-holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: 'co-yge',
          status: 'ACTIVE',
          reason,
          title,
          description: description || undefined,
          entities: [{ entityType, entityId }],
          matterDate,
          matterNumber: matterNumber || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: unknown };
        const issues = body.issues ? ` — ${JSON.stringify(body.issues).slice(0, 200)}` : '';
        setError((body.error ?? t('legalHoldCreate.errCreate', { status: res.status })) + issues);
        return;
      }
      // Reset.
      setTitle('');
      setDescription('');
      setEntityId('');
      setMatterNumber('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {t('legalHoldCreate.title')}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('legalHoldCreate.titleLabel')} required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder={t('legalHoldCreate.titlePh')}
          />
        </Field>
        <Field label={t('legalHoldCreate.reasonLabel')}>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as LegalHoldReason)}
            className={inputClass}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('legalHoldCreate.entTypeLabel')} required>
          <input
            type="text"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className={inputClass}
            placeholder={t('legalHoldCreate.entTypePh')}
          />
        </Field>
        <Field label={t('legalHoldCreate.entIdLabel')} required>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className={`${inputClass} font-mono`}
            placeholder={t('legalHoldCreate.entIdPh')}
          />
        </Field>
        <Field label={t('legalHoldCreate.matterDateLabel')}>
          <input
            type="date"
            value={matterDate}
            onChange={(e) => setMatterDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t('legalHoldCreate.matterNumLabel')}>
          <input
            type="text"
            value={matterNumber}
            onChange={(e) => setMatterNumber(e.target.value)}
            className={inputClass}
            placeholder={t('legalHoldCreate.matterNumPh')}
          />
        </Field>
      </div>

      <Field label={t('legalHoldCreate.descLabel')} className="mt-3">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputClass} h-24 resize-y`}
        />
      </Field>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          className="rounded bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? t('legalHoldCreate.busy') : t('legalHoldCreate.action')}
        </button>
        <span className="text-xs text-gray-500">
          {t('legalHoldCreate.help')}
        </span>
      </div>
    </section>
  );
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm';

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block text-xs ${className ?? ''}`}>
      <span className="mb-1 flex items-center gap-1 font-medium text-gray-700">
        {label}
        {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
