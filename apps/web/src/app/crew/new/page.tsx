'use client';

// /crew/new — add a new employee. Minimal form: name + role + classification
// + foreman + contact. Certs are added on the edit page after creation so
// the create flow stays one-screen.

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
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
      setError('First and last name are required.');
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
        setError(`${err.message} (HTTP ${err.status})`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown error');
      }
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/crew" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to crew
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Add employee</h1>
      <p className="mt-2 text-gray-700">
        Fill in the basics. You can add certifications, hire details, and notes
        on the edit page after saving.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name *">
            <input
              required
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Last name *">
            <input
              required
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Display / nickname (optional)">
          <input
            value={form.displayName}
            onChange={(e) => update('displayName', e.target.value)}
            placeholder='e.g. "Skip" — printed on the roster instead of the legal first name'
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="707-555-0100"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => update('role', e.target.value as EmployeeRole)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="DIR classification">
            <select
              value={form.classification}
              onChange={(e) =>
                update('classification', e.target.value as DirClassification)
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {classificationLabel(c)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Reports to (foreman)">
          <select
            value={form.foremanId}
            onChange={(e) => update('foremanId', e.target.value)}
            disabled={form.role === 'FOREMAN'}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">— None / office staff —</option>
            {foremen.map((f) => (
              <option key={f.id} value={f.id}>
                {fullName(f)}
              </option>
            ))}
          </select>
          {form.role === 'FOREMAN' && (
            <p className="mt-1 text-xs text-gray-500">
              Foremen don&rsquo;t report to another foreman.
            </p>
          )}
        </Field>

        <Field label="Hired on (optional)">
          <input
            type="date"
            value={form.hiredOn}
            onChange={(e) => update('hiredOn', e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Notes">
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving\u2026' : 'Save employee'}
          </button>
          <Link href="/crew" className="text-sm text-gray-600 hover:underline">
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
