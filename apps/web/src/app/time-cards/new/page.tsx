'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter } from 'next/navigation';
import { fullName, mondayOfWeek, type Employee, type TimeCard } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

export default function NewTimeCardPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [weekStarting, setWeekStarting] = useState(mondayOfWeek(new Date().toISOString().slice(0, 10)));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslator();

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    // Foreman scope: pull /api/me + portal-user-by-email so we can
    // filter employees down to the foreman's own crew (employees
    // whose foremanId equals the foreman's linked employee id).
    // Owners + office + PM see all active employees as before.
    async function loadMe(): Promise<{
      role: string;
      foremanEmployeeId: string | null;
    } | null> {
      try {
        const meRes = await fetch('/api/me', { cache: 'no-store' });
        if (!meRes.ok) return null;
        const meJson = (await meRes.json()) as {
          user?: { email?: string; role?: string };
        };
        const email = meJson.user?.email;
        const role = meJson.user?.role ?? '';
        if (!email) return null;
        const puRes = await fetch(
          `${apiBase}/api/portal-users/by-email?email=${encodeURIComponent(email)}`,
          { cache: 'no-store' },
        );
        if (!puRes.ok) return { role, foremanEmployeeId: null };
        const pu = (await puRes.json()) as {
          user?: { employeeId?: string };
        };
        return { role, foremanEmployeeId: pu.user?.employeeId ?? null };
      } catch {
        return null;
      }
    }

    void Promise.all([
      fetch(`${apiBase}/api/employees`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { employees: [] }))
        .then((j: { employees: Employee[] }) =>
          (j.employees ?? []).filter((e) => e.status === 'ACTIVE'),
        ),
      loadMe(),
    ])
      .then(([active, me]) => {
        let visible = active;
        if (me?.role === 'FOREMAN' && me.foremanEmployeeId) {
          visible = active.filter(
            (e) =>
              e.foremanId === me.foremanEmployeeId ||
              e.id === me.foremanEmployeeId, // include self
          );
        }
        setEmployees(visible);
        if (visible[0]) setEmployeeId(visible[0].id);
      })
      .catch(() => setEmployees([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!employeeId) {
      setError(t('timeCardNew.error.pickEmployee'));
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
      else setError(t('timeCardNew.error.unknown'));
      setSaving(false);
    }
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/time-cards" className="text-sm text-yge-blue-500 hover:underline">
          {t('timeCardDetail.backLink')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('timeCardNew.title')}</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('timeCardNew.field.employee')}>
          <select
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('timeCardNew.option.pickEmployee')}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {fullName(e)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('timeCardNew.field.weekStarting')}>
          <input
            type="date"
            value={weekStarting}
            onChange={(e) => setWeekStarting(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">{t('timeCardNew.hint.weekStarting')}</p>
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
            {saving ? t('timeCardNew.btn.saving') : t('timeCardNew.btn.create')}
          </button>
          <Link href="/time-cards" className="text-sm text-gray-600 hover:underline">
            {t('timeCardNew.btn.cancel')}
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
