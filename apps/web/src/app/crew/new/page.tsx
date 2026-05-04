'use client';

// /crew/new — add a new employee. Minimal form: name + role + classification
// + foreman + contact. Certs are added on the edit page after creation so
// the create flow stays one-screen.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import {
  classificationLabel,
  fullName,
  roleLabel,
  type DirClassification,
  type Employee,
  type EmployeeRole,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator, useLocale } from '../../../lib/use-translator';

const ROLES: EmployeeRole[] = [
  'FOREMAN',
  'OPERATOR',
  'TRUCK_DRIVER',
  'LABORER',
  'MECHANIC',
  'APPRENTICE',
  'SUPERINTENDENT',
  'PROJECT_MANAGER',
  'OFFICE',
  'OWNER',
  'OTHER',
];

const CLASSIFICATIONS: DirClassification[] = [
  'NOT_APPLICABLE',
  'OPERATING_ENGINEER_GROUP_1',
  'OPERATING_ENGINEER_GROUP_2',
  'OPERATING_ENGINEER_GROUP_3',
  'OPERATING_ENGINEER_GROUP_4',
  'OPERATING_ENGINEER_GROUP_5',
  'TEAMSTER_GROUP_1',
  'TEAMSTER_GROUP_2',
  'LABORER_GROUP_1',
  'LABORER_GROUP_2',
  'LABORER_GROUP_3',
  'CARPENTER',
  'CEMENT_MASON',
  'IRONWORKER',
  'OTHER',
];

interface FormState {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  email: string;
  role: EmployeeRole;
  classification: DirClassification;
  foremanId: string;
  hiredOn: string;
  notes: string;
}

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  displayName: '',
  phone: '',
  email: '',
  role: 'LABORER',
  classification: 'NOT_APPLICABLE',
  foremanId: '',
  hiredOn: '',
  notes: '',
};

export default function NewEmployeePage() {
  const t = useTranslator();
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foremen, setForemen] = useState<Employee[]>([]);

  // Fetch existing foremen so the dropdown can populate. Cheap — small list.
  useEffect(() => {
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees: Employee[] }) => {
        setForemen(
          (j.employees ?? []).filter((e) => e.role === 'FOREMAN' && e.status === 'ACTIVE'),
        );
      })
      .catch(() => setForemen([]));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    if (form.firstName.trim().length === 0 || form.lastName.trim().length === 0) {
      setError(t('newEmployee.errName'));
      return;
    }

    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role,
      classification: form.classification,
      ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.foremanId.trim() ? { foremanId: form.foremanId.trim() } : {}),
      ...(form.hiredOn.trim() ? { hiredOn: form.hiredOn.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };

    setSaving(true);
    try {
      const res = await postJson<{ employee: Employee }>('/api/employees', body);
      router.push(`/crew/${res.employee.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t('newEmployee.errHttp', { msg: err.message, status: err.status }));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('newEmployee.errUnknown'));
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/crew" className="text-sm text-yge-blue-500 hover:underline">
          {t('newEmployee.back')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newEmployee.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newEmployee.subtitle')}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('newEmployee.lblFirstName')}>
            <input
              required
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('newEmployee.lblLastName')}>
            <input
              required
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label={t('newEmployee.lblDisplayName')}>
          <input
            value={form.displayName}
            onChange={(e) => update('displayName', e.target.value)}
            placeholder={t('newEmployee.phDisplayName')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('newEmployee.lblPhone')}>
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="707-555-0100"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label={t('newEmployee.lblEmail')}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('newEmployee.lblRole')}>
            <select
              value={form.role}
              onChange={(e) => update('role', e.target.value as EmployeeRole)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r, locale)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('newEmployee.lblClassification')}>
            <select
              value={form.classification}
              onChange={(e) =>
                update('classification', e.target.value as DirClassification)
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {classificationLabel(c, locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t('newEmployee.lblForeman')}>
          <select
            value={form.foremanId}
            onChange={(e) => update('foremanId', e.target.value)}
            disabled={form.role === 'FOREMAN'}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">{t('newEmployee.noneForeman')}</option>
            {foremen.map((f) => (
              <option key={f.id} value={f.id}>
                {fullName(f)}
              </option>
            ))}
          </select>
          {form.role === 'FOREMAN' && (
            <p className="mt-1 text-xs text-gray-500">
              {t('newEmployee.foremanNote')}
            </p>
          )}
        </Field>

        <Field label={t('newEmployee.lblHiredOn')}>
          <input
            type="date"
            value={form.hiredOn}
            onChange={(e) => update('hiredOn', e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label={t('newEmployee.lblNotes')}>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? t('newEmployee.busy') : t('newEmployee.action')}
          </button>
          <Link href="/crew" className="text-sm text-gray-600 hover:underline">
            {t('newEmployee.cancel')}
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
