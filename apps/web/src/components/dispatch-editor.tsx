// Dispatch editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  dispatchStatusLabel,
  type Dispatch,
  type DispatchCrewMember,
  type DispatchEquipment,
  type DispatchStatus,
} from '@yge/shared';

const STATUSES: DispatchStatus[] = ['DRAFT', 'POSTED', 'COMPLETED', 'CANCELLED'];

interface FormState {
  jobId: string;
  scheduledFor: string;
  foremanName: string;
  foremanPhone: string;
  meetTime: string;
  meetLocation: string;
  scopeOfWork: string;
  specialInstructions: string;
  status: DispatchStatus;
  notes: string;
  crew: DispatchCrewMember[];
  equipment: DispatchEquipment[];
}

function defaults(d?: Dispatch): FormState {
  return {
    jobId: d?.jobId ?? '',
    scheduledFor: d?.scheduledFor ?? new Date().toISOString().slice(0, 10),
    foremanName: d?.foremanName ?? '',
    foremanPhone: d?.foremanPhone ?? '',
    meetTime: d?.meetTime ?? '06:00',
    meetLocation: d?.meetLocation ?? 'Cottonwood yard',
    scopeOfWork: d?.scopeOfWork ?? '',
    specialInstructions: d?.specialInstructions ?? '',
    status: d?.status ?? 'DRAFT',
    notes: d?.notes ?? '',
    crew: d?.crew ?? [],
    equipment: d?.equipment ?? [],
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function DispatchEditor({
  mode,
  dispatch,
}: {
  mode: 'create' | 'edit';
  dispatch?: Dispatch;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [form, setForm] = useState<FormState>(defaults(dispatch));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addCrewMember() {
    setField('crew', [...form.crew, { name: '' }]);
  }
  function updateCrewMember(i: number, patch: Partial<DispatchCrewMember>) {
    setField('crew', form.crew.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCrewMember(i: number) {
    setField('crew', form.crew.filter((_, idx) => idx !== i));
  }

  function addEquipment() {
    setField('equipment', [...form.equipment, { name: '' }]);
  }
  function updateEquipment(i: number, patch: Partial<DispatchEquipment>) {
    setField(
      'equipment',
      form.equipment.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  }
  function removeEquipment(i: number) {
    setField('equipment', form.equipment.filter((_, idx) => idx !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      jobId: form.jobId.trim(),
      scheduledFor: form.scheduledFor,
      foremanName: form.foremanName.trim(),
      foremanPhone: trim(form.foremanPhone),
      meetTime: trim(form.meetTime),
      meetLocation: trim(form.meetLocation),
      scopeOfWork: form.scopeOfWork.trim(),
      specialInstructions: trim(form.specialInstructions),
      status: form.status,
      notes: trim(form.notes),
      crew: form.crew
        .filter((c) => c.name.trim().length > 0)
        .map((c) => ({
          ...c,
          name: c.name.trim(),
          role: c.role?.trim() || undefined,
          note: c.note?.trim() || undefined,
          employeeId: c.employeeId?.trim() || undefined,
        })),
      equipment: form.equipment
        .filter((e) => e.name.trim().length > 0)
        .map((e) => ({
          ...e,
          name: e.name.trim(),
          operatorName: e.operatorName?.trim() || undefined,
          note: e.note?.trim() || undefined,
          equipmentId: e.equipmentId?.trim() || undefined,
        })),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/dispatches`
          : `${apiBaseUrl()}/api/dispatches/${dispatch!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { dispatch: Dispatch };
      if (mode === 'create') {
        router.push(`/dispatch/${json.dispatch.id}`);
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

      <Section title={t('dispatchEditor.secDay')}>
        <Field label={t('dispatchEditor.lblJobId')} required>
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder={t('dispatchEditor.phJobId')}
            required
          />
        </Field>
        <Field label={t('dispatchEditor.lblScheduled')} required>
          <input
            type="date"
            className={inputCls}
            value={form.scheduledFor}
            onChange={(e) => setField('scheduledFor', e.target.value)}
            required
          />
        </Field>
        <Field label={t('dispatchEditor.lblStatus')}>
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as DispatchStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {dispatchStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={t('dispatchEditor.secForeman')}>
        <Field label={t('dispatchEditor.lblForemanName')} required>
          <input
            className={inputCls}
            value={form.foremanName}
            onChange={(e) => setField('foremanName', e.target.value)}
            required
          />
        </Field>
        <Field label={t('dispatchEditor.lblForemanPhone')}>
          <input
            className={inputCls}
            value={form.foremanPhone}
            onChange={(e) => setField('foremanPhone', e.target.value)}
          />
        </Field>
        <Field label={t('dispatchEditor.lblMeetTime')}>
          <input
            className={inputCls}
            value={form.meetTime}
            onChange={(e) => setField('meetTime', e.target.value)}
            placeholder={t('dispatchEditor.phMeetTime')}
          />
        </Field>
        <Field label={t('dispatchEditor.lblMeetLoc')}>
          <input
            className={inputCls}
            value={form.meetLocation}
            onChange={(e) => setField('meetLocation', e.target.value)}
          />
        </Field>
      </Section>

      <Section title={t('dispatchEditor.secScope')}>
        <Field label={t('dispatchEditor.lblScope')} required full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={form.scopeOfWork}
            onChange={(e) => setField('scopeOfWork', e.target.value)}
            required
          />
        </Field>
        <Field label={t('dispatchEditor.lblSpecial')} full>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={form.specialInstructions}
            onChange={(e) => setField('specialInstructions', e.target.value)}
          />
        </Field>
      </Section>

      <RowList
        title={t('dispatchEditor.crewTitle', { count: form.crew.length })}
        addLabel={t('dispatchEditor.crewAdd')}
        onAdd={addCrewMember}
      >
        {form.crew.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            {t('dispatchEditor.crewEmpty')}
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-1">{t('dispatchEditor.thName')}</th>
                <th className="py-1">{t('dispatchEditor.thRole')}</th>
                <th className="py-1">{t('dispatchEditor.thNote')}</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.crew.map((c, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={c.name}
                      onChange={(e) => updateCrewMember(i, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={c.role ?? ''}
                      onChange={(e) => updateCrewMember(i, { role: e.target.value })}
                      placeholder={t('dispatchEditor.phRole')}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={c.note ?? ''}
                      onChange={(e) => updateCrewMember(i, { note: e.target.value })}
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeCrewMember(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('dispatchEditor.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </RowList>

      <RowList
        title={t('dispatchEditor.equipTitle', { count: form.equipment.length })}
        addLabel={t('dispatchEditor.equipAdd')}
        onAdd={addEquipment}
      >
        {form.equipment.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">{t('dispatchEditor.equipEmpty')}</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-1">{t('dispatchEditor.thEquipment')}</th>
                <th className="py-1">{t('dispatchEditor.thOperator')}</th>
                <th className="py-1">{t('dispatchEditor.thNote')}</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.equipment.map((e, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={e.name}
                      onChange={(ev) => updateEquipment(i, { name: ev.target.value })}
                      placeholder={t('dispatchEditor.phEquipment')}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={e.operatorName ?? ''}
                      onChange={(ev) => updateEquipment(i, { operatorName: ev.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={e.note ?? ''}
                      onChange={(ev) => updateEquipment(i, { note: ev.target.value })}
                    />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeEquipment(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('dispatchEditor.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </RowList>

      <Section title={t('dispatchEditor.secNotes')}>
        <Field label={t('dispatchEditor.lblNotes')} full>
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
          {saving ? t('dispatchEditor.busy') : mode === 'create' ? t('dispatchEditor.create') : t('dispatchEditor.save')}
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

function RowList({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h2>
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-yge-blue-500 px-2 py-1 text-xs text-yge-blue-500 hover:bg-yge-blue-50"
        >
          {addLabel}
        </button>
      </div>
      {children}
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
