'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, AppShell } from '../../../components';
import type {
  EquipmentServiceRecord,
  ServiceRecordCategory,
  ServiceRecordPriority,
} from '@yge/shared';
import { serviceRecordCategoryLabel, serviceRecordPriorityLabel } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

const PRIORITIES: ServiceRecordPriority[] = ['SAFETY_CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES: ServiceRecordCategory[] = [
  'HYDRAULIC',
  'ENGINE',
  'UNDERCARRIAGE',
  'ELECTRICAL',
  'TIRES_TRACKS',
  'LIGHTS',
  'SAFETY_EQUIPMENT',
  'PM',
  'BREAKDOWN_REPAIR',
  'INSPECTION_FOLLOWUP',
  'OTHER',
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function NewServiceRecordPage() {
  const router = useRouter();
  const [equipmentId, setEquipmentId] = useState('');
  const [openedOn, setOpenedOn] = useState(todayIso());
  const [requestedByName, setRequestedByName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ServiceRecordPriority>('MEDIUM');
  const [category, setCategory] = useState<ServiceRecordCategory>('BREAKDOWN_REPAIR');
  const [redTagged, setRedTagged] = useState(false);
  const [hoursAtRequest, setHoursAtRequest] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!equipmentId.trim()) { setError('Equipment id is required.'); return; }
    if (!requestedByName.trim()) { setError('Requested-by name is required.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }
    setSaving(true);
    const body: Record<string, unknown> = {
      equipmentId: equipmentId.trim(),
      openedOn,
      requestedByName: requestedByName.trim(),
      description: description.trim(),
      priority,
      category,
      redTagged: redTagged || priority === 'SAFETY_CRITICAL',
    };
    if (hoursAtRequest) {
      const h = Number(hoursAtRequest);
      if (!Number.isNaN(h) && h >= 0) body.hoursAtRequest = h;
    }
    try {
      const res = await postJson<{ record: EquipmentServiceRecord }>(
        '/api/equipment-service-records',
        body,
      );
      router.push(`/equipment-service-records/${res.record.id}`);
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
          <Link href="/equipment-service-records" className="text-sm text-yge-blue-500 hover:underline">
            ← Back to service records
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-yge-blue-500">New work order</h1>
        <p className="mt-2 text-gray-700">
          Open a work order against a piece of equipment. SAFETY-CRITICAL priority auto red-tags the machine.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Equipment id">
              <input required value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} placeholder="eq-…" className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono" />
            </Field>
            <Field label="Opened on">
              <input required type="date" value={openedOn} onChange={(e) => setOpenedOn(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
          </div>
          <Field label="Requested by (foreman name)">
            <input required value={requestedByName} onChange={(e) => setRequestedByName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="Description">
            <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's wrong?" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as ServiceRecordPriority)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
                {PRIORITIES.map((p) => (<option key={p} value={p}>{serviceRecordPriorityLabel(p)}</option>))}
              </select>
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as ServiceRecordCategory)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
                {CATEGORIES.map((c) => (<option key={c} value={c}>{serviceRecordCategoryLabel(c)}</option>))}
              </select>
            </Field>
            <Field label="Hours at request">
              <input type="number" step="0.1" min="0" value={hoursAtRequest} onChange={(e) => setHoursAtRequest(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={redTagged} onChange={(e) => setRedTagged(e.target.checked)} />
            <span className="font-medium text-gray-700">Red-tag this machine (always on for SAFETY-CRITICAL)</span>
          </label>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
              {saving ? 'Opening…' : 'Open work order'}
            </button>
            <Link href="/equipment-service-records" className="text-sm text-gray-600 hover:underline">Cancel</Link>
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
