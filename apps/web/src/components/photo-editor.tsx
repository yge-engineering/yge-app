// Photo log editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  photoCategoryLabel,
  type Photo,
  type PhotoCategory,
} from '@yge/shared';

const CATEGORIES: PhotoCategory[] = [
  'PROGRESS',
  'PRE_CONSTRUCTION',
  'DELAY',
  'CHANGE_ORDER',
  'SWPPP',
  'INCIDENT',
  'PUNCH',
  'COMPLETION',
  'OTHER',
];

interface FormState {
  jobId: string;
  takenOn: string;
  takenAt: string;
  location: string;
  caption: string;
  photographerName: string;
  category: PhotoCategory;
  reference: string;
  latitude: string;
  longitude: string;
  rfiId: string;
  changeOrderId: string;
  swpppInspectionId: string;
  incidentId: string;
  punchItemId: string;
  dailyReportId: string;
  notes: string;
}

function defaults(p?: Photo): FormState {
  return {
    jobId: p?.jobId ?? '',
    takenOn: p?.takenOn ?? new Date().toISOString().slice(0, 10),
    takenAt: p?.takenAt ?? '',
    location: p?.location ?? '',
    caption: p?.caption ?? '',
    photographerName: p?.photographerName ?? 'Ryan D. Young',
    category: p?.category ?? 'PROGRESS',
    reference: p?.reference ?? '',
    latitude: p?.latitude != null ? String(p.latitude) : '',
    longitude: p?.longitude != null ? String(p.longitude) : '',
    rfiId: p?.rfiId ?? '',
    changeOrderId: p?.changeOrderId ?? '',
    swpppInspectionId: p?.swpppInspectionId ?? '',
    incidentId: p?.incidentId ?? '',
    punchItemId: p?.punchItemId ?? '',
    dailyReportId: p?.dailyReportId ?? '',
    notes: p?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function PhotoEditor({
  mode,
  photo,
}: {
  mode: 'create' | 'edit';
  photo?: Photo;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(photo));
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
    const num = (s: string) => {
      if (s.trim().length === 0) return undefined;
      const n = Number(s);
      return Number.isFinite(n) ? n : undefined;
    };
    const body: Record<string, unknown> = {
      jobId: form.jobId.trim(),
      takenOn: form.takenOn,
      takenAt: trim(form.takenAt),
      location: form.location.trim(),
      caption: form.caption.trim(),
      photographerName: trim(form.photographerName),
      category: form.category,
      reference: form.reference.trim(),
      latitude: num(form.latitude),
      longitude: num(form.longitude),
      rfiId: trim(form.rfiId),
      changeOrderId: trim(form.changeOrderId),
      swpppInspectionId: trim(form.swpppInspectionId),
      incidentId: trim(form.incidentId),
      punchItemId: trim(form.punchItemId),
      dailyReportId: trim(form.dailyReportId),
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/photos`
          : `${apiBaseUrl()}/api/photos/${photo!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { photo: Photo };
      if (mode === 'create') {
        router.push(`/photos/${json.photo.id}`);
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

      <Section title="Photo">
        <Field label="Job ID" required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder="job-YYYY-MM-DD-..."
            required
          />
        </Field>
        <Field label="Category">
          <select
            className={inputCls}
            value={form.category}
            onChange={(e) => setField('category', e.target.value as PhotoCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {photoCategoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date taken" required>
          <input
            type="date"
            className={inputCls}
            value={form.takenOn}
            onChange={(e) => setField('takenOn', e.target.value)}
            required
          />
        </Field>
        <Field label="Time (HH:MM)">
          <input
            className={inputCls}
            value={form.takenAt}
            onChange={(e) => setField('takenAt', e.target.value)}
            placeholder="14:30"
          />
        </Field>
        <Field label="Location" required>
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="Sta. 12+50 LT, basin #3"
            required
          />
        </Field>
        <Field label="Photographer">
          <input
            className={inputCls}
            value={form.photographerName}
            onChange={(e) => setField('photographerName', e.target.value)}
          />
        </Field>
        <Field label="Caption" required full>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={form.caption}
            onChange={(e) => setField('caption', e.target.value)}
            required
          />
        </Field>
      </Section>

      <Section title="File reference">
        <Field label="Reference (filename, drive path, URL)" required full>
          <input
            className={inputCls}
            value={form.reference}
            onChange={(e) => setField('reference', e.target.value)}
            placeholder="IMG_2026-04-25-01.jpg"
            required
          />
        </Field>
      </Section>

      <Section title="GPS (optional)">
        <Field label="Latitude (decimal)">
          <input
            type="number"
            step="0.000001"
            className={inputCls}
            value={form.latitude}
            onChange={(e) => setField('latitude', e.target.value)}
            placeholder="40.385"
          />
        </Field>
        <Field label="Longitude (decimal)">
          <input
            type="number"
            step="0.000001"
            className={inputCls}
            value={form.longitude}
            onChange={(e) => setField('longitude', e.target.value)}
            placeholder="-122.275"
          />
        </Field>
      </Section>

      <Section title="Cross-references (optional)">
        <Field label="RFI ID">
          <input
            className={inputCls}
            value={form.rfiId}
            onChange={(e) => setField('rfiId', e.target.value)}
            placeholder="rfi-xxxxxxxx"
          />
        </Field>
        <Field label="Change order ID">
          <input
            className={inputCls}
            value={form.changeOrderId}
            onChange={(e) => setField('changeOrderId', e.target.value)}
            placeholder="co-xxxxxxxx"
          />
        </Field>
        <Field label="SWPPP inspection ID">
          <input
            className={inputCls}
            value={form.swpppInspectionId}
            onChange={(e) => setField('swpppInspectionId', e.target.value)}
            placeholder="swp-xxxxxxxx"
          />
        </Field>
        <Field label="Incident ID">
          <input
            className={inputCls}
            value={form.incidentId}
            onChange={(e) => setField('incidentId', e.target.value)}
            placeholder="inc-xxxxxxxx"
          />
        </Field>
        <Field label="Punch item ID">
          <input
            className={inputCls}
            value={form.punchItemId}
            onChange={(e) => setField('punchItemId', e.target.value)}
            placeholder="pi-xxxxxxxx"
          />
        </Field>
        <Field label="Daily report ID">
          <input
            className={inputCls}
            value={form.dailyReportId}
            onChange={(e) => setField('dailyReportId', e.target.value)}
            placeholder="dr-xxxxxxxx"
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" full>
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
          {saving ? 'Saving…' : mode === 'create' ? 'Log photo' : 'Save changes'}
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
