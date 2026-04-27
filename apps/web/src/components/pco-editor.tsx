// PCO editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  dollarsToCents,
  pcoOriginLabel,
  pcoStatusLabel,
  type Pco,
  type PcoOrigin,
  type PcoStatus,
} from '@yge/shared';

const STATUSES: PcoStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED_PENDING_CO',
  'REJECTED',
  'WITHDRAWN',
  'CONVERTED_TO_CO',
];
const ORIGINS: PcoOrigin[] = [
  'OWNER_DIRECTED',
  'DESIGN_CHANGE',
  'UNFORESEEN_CONDITION',
  'RFI_RESPONSE',
  'SPEC_CONFLICT',
  'WEATHER_DELAY',
  'OTHER',
];

interface FormState {
  jobId: string;
  pcoNumber: string;
  agencyPcoNumber: string;
  title: string;
  description: string;
  origin: PcoOrigin;
  status: PcoStatus;
  noticedOn: string;
  submittedOn: string;
  lastResponseOn: string;
  costImpactDollars: string;
  scheduleImpactDays: string;
  rfiId: string;
  changeOrderId: string;
  agencyContact: string;
  preparedByName: string;
  notes: string;
}

function defaults(p?: Pco): FormState {
  return {
    jobId: p?.jobId ?? '',
    pcoNumber: p?.pcoNumber ?? '',
    agencyPcoNumber: p?.agencyPcoNumber ?? '',
    title: p?.title ?? '',
    description: p?.description ?? '',
    origin: p?.origin ?? 'OTHER',
    status: p?.status ?? 'DRAFT',
    noticedOn: p?.noticedOn ?? new Date().toISOString().slice(0, 10),
    submittedOn: p?.submittedOn ?? '',
    lastResponseOn: p?.lastResponseOn ?? '',
    costImpactDollars: p?.costImpactCents != null ? (p.costImpactCents / 100).toFixed(2) : '0',
    scheduleImpactDays: String(p?.scheduleImpactDays ?? 0),
    rfiId: p?.rfiId ?? '',
    changeOrderId: p?.changeOrderId ?? '',
    agencyContact: p?.agencyContact ?? '',
    preparedByName: p?.preparedByName ?? 'Ryan D. Young',
    notes: p?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function PcoEditor({
  mode,
  pco,
}: {
  mode: 'create' | 'edit';
  pco?: Pco;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(pco));
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
    const body: Record<string, unknown> = {
      jobId: form.jobId.trim(),
      pcoNumber: form.pcoNumber.trim(),
      agencyPcoNumber: trim(form.agencyPcoNumber),
      title: form.title.trim(),
      description: form.description.trim(),
      origin: form.origin,
      status: form.status,
      noticedOn: form.noticedOn,
      submittedOn: trim(form.submittedOn),
      lastResponseOn: trim(form.lastResponseOn),
      costImpactCents: dollarsToCents(Number(form.costImpactDollars || 0)),
      scheduleImpactDays: Math.round(Number(form.scheduleImpactDays || 0)),
      rfiId: trim(form.rfiId),
      changeOrderId: trim(form.changeOrderId),
      agencyContact: trim(form.agencyContact),
      preparedByName: trim(form.preparedByName),
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/pcos`
          : `${apiBaseUrl()}/api/pcos/${pco!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { pco: Pco };
      if (mode === 'create') {
        router.push(`/pcos/${json.pco.id}`);
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

      <Section title="Identification">
        <Field label="Job ID" required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder="job-YYYY-MM-DD-..."
            required
          />
        </Field>
        <Field label="PCO #" required>
          <input
            className={inputCls}
            value={form.pcoNumber}
            onChange={(e) => setField('pcoNumber', e.target.value)}
            placeholder="PCO-001"
            required
          />
        </Field>
        <Field label="Agency PCO #">
          <input
            className={inputCls}
            value={form.agencyPcoNumber}
            onChange={(e) => setField('agencyPcoNumber', e.target.value)}
          />
        </Field>
        <Field label="Origin">
          <select
            className={inputCls}
            value={form.origin}
            onChange={(e) => setField('origin', e.target.value as PcoOrigin)}
          >
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {pcoOriginLabel(o)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Scope">
        <Field label="Title" required full>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            required
          />
        </Field>
        <Field label="Description" full>
          <textarea
            className={`${inputCls} min-h-[100px]`}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Money + schedule">
        <Field label="Cost impact ($)">
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={form.costImpactDollars}
            onChange={(e) => setField('costImpactDollars', e.target.value)}
          />
        </Field>
        <Field label="Schedule impact (days)">
          <input
            type="number"
            className={inputCls}
            value={form.scheduleImpactDays}
            onChange={(e) => setField('scheduleImpactDays', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Status + dates">
        <Field label="Status">
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as PcoStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {pcoStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Noticed on" required>
          <input
            type="date"
            className={inputCls}
            value={form.noticedOn}
            onChange={(e) => setField('noticedOn', e.target.value)}
            required
          />
        </Field>
        <Field label="Submitted on">
          <input
            type="date"
            className={inputCls}
            value={form.submittedOn}
            onChange={(e) => setField('submittedOn', e.target.value)}
          />
        </Field>
        <Field label="Last agency response">
          <input
            type="date"
            className={inputCls}
            value={form.lastResponseOn}
            onChange={(e) => setField('lastResponseOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Cross-references">
        <Field label="Triggering RFI ID">
          <input
            className={inputCls}
            value={form.rfiId}
            onChange={(e) => setField('rfiId', e.target.value)}
            placeholder="rfi-xxxxxxxx"
          />
        </Field>
        <Field label="Executed CO ID">
          <input
            className={inputCls}
            value={form.changeOrderId}
            onChange={(e) => setField('changeOrderId', e.target.value)}
            placeholder="co-xxxxxxxx"
          />
        </Field>
        <Field label="Agency contact">
          <input
            className={inputCls}
            value={form.agencyContact}
            onChange={(e) => setField('agencyContact', e.target.value)}
          />
        </Field>
        <Field label="Prepared by">
          <input
            className={inputCls}
            value={form.preparedByName}
            onChange={(e) => setField('preparedByName', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" full>
          <textarea
            className={`${inputCls} min-h-[100px]`}
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
          {saving ? 'Saving…' : mode === 'create' ? 'Create PCO' : 'Save changes'}
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
