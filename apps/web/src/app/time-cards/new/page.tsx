'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import { fullName, mondayOfWeek, type Employee, type TimeCard } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

export default function NewTimeCardPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [weekStarting, setWeekStarting] = useState(mondayOfWeek(new Date().toISOString().slice(0, 10)));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/employees`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((j: { employees: Employee[] }) => {
        const active = (j.employees ?? []).filter((e) => e.status === 'ACTIVE');
        setEmployees(active);
        if (active[0]) setEmployeeId(active[0].id);
      })
      .catch(() => setEmployees([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!employeeId) {
      setError('Pick an employee.');
      return;
    }
    setSaving(true);
    try {
      const res = await postJson<{ timeCard: TimeCard }>('/api/time-cards', {
        employeeId,
        weekStarting: mondayOfWeek(weekStarting),
      });
      router.push(`/time-cards/${res.timeCard.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (HTTP ${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError('Unknown error');
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/time-cards" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to time cards
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">New time card</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label="Employee *">
          <select
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— Pick an employee —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {fullName(e)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Week starting (Monday)">
          <input
            type="date"
            value={weekStarting}
            onChange={(e) => setWeekStarting(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            If you pick mid-week, we&rsquo;ll snap to the Monday automatically.
          </p>
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
            {saving ? 'Saving…' : 'Create card'}
          </button>
          <Link href="/time-cards" className="text-sm text-gray-600 hover:underline">
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
