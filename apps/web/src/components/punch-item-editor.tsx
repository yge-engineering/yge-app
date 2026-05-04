// Punch item editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  punchItemSeverityLabel,
  punchItemStatusLabel,
  type PunchItem,
  type PunchItemSeverity,
  type PunchItemStatus,
} from '@yge/shared';

const SEVERITIES: PunchItemSeverity[] = ['SAFETY', 'MAJOR', 'MINOR'];
const STATUSES: PunchItemStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'DISPUTED',
  'WAIVED',
];

interface FormState {
  jobId: string;
  identifiedOn: string;
  location: string;
  description: string;
  severity: PunchItemSeverity;
  status: PunchItemStatus;
  responsibleParty: string;
  responsibleVendorId: string;
  dueOn: string;
  closedOn: string;
  closedByInitials: string;
  photoRefs: string;
  notes: string;
}

function defaults(p?: PunchItem): FormState {
  return {
    jobId: p?.jobId ?? '',
    identifiedOn: p?.identifiedOn ?? new Date().toISOString().slice(0, 10),
    location: p?.location ?? '',
    description: p?.description ?? '',
    severity: p?.severity ?? 'MINOR',
    status: p?.status ?? 'OPEN',
    responsibleParty: p?.responsibleParty ?? '',
    responsibleVendorId: p?.responsibleVendorId ?? '',
    dueOn: p?.dueOn ?? '',
    closedOn: p?.closedOn ?? '',
    closedByInitials: p?.closedByInitials ?? '',
    photoRefs: (p?.photoRefs ?? []).join('\n'),
    notes: p?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function PunchItemEditor({
  mode,
  item,
}: {
  mode: 'create' | 'edit';
  item?: PunchItem;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [form, setForm] = useState<FormState>(defaults(item));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const photoRefs = form.photoRefs
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const body: Record<string, unknown> = {
      jobId: form.jobId.trim(),
      identifiedOn: form.identifiedOn,
      location: form.location.trim(),
      description: form.description.trim(),
      severity: form.severity,
      status: form.status,
      responsibleParty: trim(form.responsibleParty),
      responsibleVendorId: trim(form.responsibleVendorId),
      dueOn: trim(form.dueOn),
      closedOn: trim(form.closedOn),
      closedByInitials: trim(form.closedByInitials),
      photoRefs: photoRefs.length > 0 ? photoRefs : undefined,
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/punch-items`
          : `${apiBaseUrl()}/api/punch-items/${item!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { item: PunchItem };
      if (mode === 'create') {
        router.push(`/punch-list/${json.item.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Section title={t('punchItem.secJob')}>
        <Field label={t('punchItem.lblJobId')} required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder={t('punchItem.phJobId')}
            required
          />
        </Field>
        <Field label={t('punchItem.lblIdentified')} required>
          <input
            type="date"
            className={inputCls}
            value={form.identifiedOn}
            onChange={(e) => setField('identifiedOn', e.target.value)}
            required
          />
        </Field>
      </Section>

      <Section title={t('punchItem.secItem')}>
        <Field label={t('punchItem.lblLocation')} required>
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder={t('punchItem.phLocation')}
            required
          />
        </Field>
        <Field label={t('punchItem.lblSeverity')}>
          <select
            className={inputCls}
            value={form.severity}
            onChange={(e) => setField('severity', e.target.value as PunchItemSeverity)}
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {punchItemSeverityLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('punchItem.lblDescription')} required full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            required
          />
        </Field>
      </Section>

      <Section title={t('punchItem.secResp')}>
        <Field label={t('punchItem.lblRespParty')}>
          <input
            className={inputCls}
            value={form.responsibleParty}
            onChange={(e) => setField('responsibleParty', e.target.value)}
            placeholder={t('punchItem.phRespParty')}
          />
        </Field>
        <Field label={t('punchItem.lblRespVendor')}>
          <input
            className={inputCls}
            value={form.responsibleVendorId}
            onChange={(e) => setField('responsibleVendorId', e.target.value)}
            placeholder={t('punchItem.phRespVendor')}
          />
        </Field>
        <Field label={t('punchItem.lblDue')}>
          <input
            type="date"
            className={inputCls}
            value={form.dueOn}
            onChange={(e) => setField('dueOn', e.target.value)}
          />
        </Field>
        <Field label={t('punchItem.lblStatus')}>
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as PunchItemStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {punchItemStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={t('punchItem.secCloseout')}>
        <Field label={t('punchItem.lblClosed')}>
          <input
            type="date"
            className={inputCls}
            value={form.closedOn}
            onChange={(e) => setField('closedOn', e.target.value)}
          />
        </Field>
        <Field label={t('punchItem.lblVerifiedBy')}>
          <input
            className={inputCls}
            value={form.closedByInitials}
            onChange={(e) => setField('closedByInitials', e.target.value)}
            placeholder={t('punchItem.phVerifiedBy')}
          />
        </Field>
      </Section>

      <Section title={t('punchItem.secPhotos')}>
        <Field label={t('punchItem.lblPhotoRefs')} full>
          <textarea
            className={`${inputCls} min-h-[60px] font-mono`}
            value={form.photoRefs}
            onChange={(e) => setField('photoRefs', e.target.value)}
            placeholder={t('punchItem.phPhotoRefs')}
          />
        </Field>
        <Field label={t('punchItem.lblNotes')} full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {saving ? t('punchItem.busy') : mode === 'create' ? t('punchItem.create') : t('punchItem.save')}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
