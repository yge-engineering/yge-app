'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, AppShell } from '../../../components';
import type {
  Equipment,
  EquipmentInspection,
  EquipmentInspectionType,
  Job,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

const TYPES: EquipmentInspectionType[] = [
  'PRE_SHIFT',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'ANNUAL',
  'POST_INCIDENT',
  'OTHER',
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewEquipmentInspectionPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [jobId, setJobId] = useState('');
  const [type, setType] = useState<EquipmentInspectionType>('PRE_SHIFT');
  const [inspectedOn, setInspectedOn] = useState(todayIso());
  const [inspectedAt, setInspectedAt] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [hoursReading, setHoursReading] = useState('');
  const [mileageReading, setMileageReading] = useState('');
  const [defects, setDefects] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [outOfService, setOutOfService] = useState(false);
  const [outOfServiceReason, setOutOfServiceReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    void Promise.all([
      fetch(`${apiBase}/api/equipment`, { cache: 'no-store' }).then((r) =>
        r.ok ? (r.json() as Promise<{ equipment: Equipment[] }>) : { equipment: [] },
      ),
      fetch(`${apiBase}/api/jobs`, { cache: 'no-store' }).then((r) =>
        r.ok ? (r.json() as Promise<{ jobs: Job[] }>) : { jobs: [] },
      ),
    ])
      .then(([e, j]) => {
        setEquipment(e.equipment ?? []);
        setJobs(j.jobs ?? []);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!equipmentId) {
      setError('Pick an equipment unit.');
      return;
    }
    if (!inspectorName.trim()) {
      setError('Inspector name is required.');
      return;
    }
    if (!inspectedOn) {
      setError('Inspection date is required.');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      equipmentId,
      type,
      inspectedOn,
      inspectorName: inspectorName.trim(),
      checks: [],
      photoRefs: [],
      outOfService,
    };
    if (jobId) body.jobId = jobId;
    if (inspectedAt) body.inspectedAt = inspectedAt;
    if (hoursReading) {
      const h = Number(hoursReading);
      if (!Number.isNaN(h) && h >= 0) body.hoursReading = h;
    }
    if (mileageReading) {
      const m = parseInt(mileageReading, 10);
      if (!Number.isNaN(m) && m >= 0) body.mileageReading = m;
    }
    if (defects.trim()) body.defects = defects.trim();
    if (correctiveAction.trim()) body.correctiveAction = correctiveAction.trim();
    if (outOfService && outOfServiceReason.trim()) {
      body.outOfServiceReason = outOfServiceReason.trim();
    }
    if (notes.trim()) body.notes = notes.trim();
    try {
      const res = await postJson<{ inspection: EquipmentInspection }>(
        '/api/equipment-inspections',
        body,
      );
      router.push(`/equipment-inspections/${res.inspection.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError('Unknown error');
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-8">
        <div className="mb-6">
          <Link
            href="/equipment-inspections"
            className="text-sm text-yge-blue-500 hover:underline"
          >
            ← Back to inspections
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-yge-blue-500">New equipment inspection</h1>
        <p className="mt-2 text-gray-700">
          Pre-shift / periodic safety check. Flag the unit out-of-service when it&apos;s unsafe to operate.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Equipment">
            <select
              required
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Pick equipment</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EquipmentInspectionType)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                required
                type="date"
                value={inspectedOn}
                onChange={(e) => setInspectedOn(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Time (optional)">
              <input
                type="time"
                value={inspectedAt}
                onChange={(e) => setInspectedAt(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Inspector name">
            <input
              required
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Job (optional)">
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">(none)</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.projectName}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hours reading">
              <input
                type="number"
                min="0"
                step="0.1"
                value={hoursReading}
                onChange={(e) => setHoursReading(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Mileage">
              <input
                type="number"
                min="0"
                step="1"
                value={mileageReading}
                onChange={(e) => setMileageReading(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Defects found">
            <textarea
              rows={3}
              value={defects}
              onChange={(e) => setDefects(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="What's wrong with the unit?"
            />
          </Field>

          <Field label="Corrective action">
            <textarea
              rows={2}
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="What did you do about it?"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={outOfService}
              onChange={(e) => setOutOfService(e.target.checked)}
            />
            <span className="font-medium text-gray-700">Out of service</span>
          </label>

          {outOfService && (
            <Field label="OOS reason">
              <input
                value={outOfServiceReason}
                onChange={(e) => setOutOfServiceReason(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Why is it tagged out?"
              />
            </Field>
          )}

          <Field label="Notes">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Log inspection'}
            </button>
            <Link
              href="/equipment-inspections"
              className="text-sm text-gray-600 hover:underline"
            >
              Cancel
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
