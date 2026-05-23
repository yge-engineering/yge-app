'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AppShell } from '../../../components';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  buildDraftCprRows,
  mondayOfWeek,
  type CertifiedPayroll,
  type CprEmployeeRow,
  type DraftCprRow,
  type Employee,
  type Job,
  type TimeCard,
} from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { useTranslator } from '../../../lib/use-translator';

function sundayOfWeek(monday: string): string {
  const d = new Date(monday + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return monday;
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export default function NewCprPage() {
  const t = useTranslator();
  const router = useRouter();
  const initialJobId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('jobId') ?? ''
      : '';
  const [jobId, setJobId] = useState(initialJobId);
  // Suppress unused-search-params lint warning if Next adds the hook later.
  void useSearchParams;
  const [weekStarting, setWeekStarting] = useState(mondayOfWeek(new Date().toISOString().slice(0, 10)));
  const [payrollNumber, setPayrollNumber] = useState('1');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<DraftCprRow[]>([]);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs: Job[] }) => {
        setJobs(j.jobs ?? []);
        if (j.jobs?.[0]) setJobId(j.jobs[0].id);
      })
      .catch(() => setJobs([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!jobId) {
      setError(t('newCpr.errPickJob'));
      return;
    }
    const week = mondayOfWeek(weekStarting);
    setSaving(true);
    try {
      const job = jobs.find((j) => j.id === jobId);
      const rows: CprEmployeeRow[] = draftRows.map(draftToCprRow);
      const res = await postJson<{ certifiedPayroll: CertifiedPayroll }>(
        '/api/certified-payrolls',
        {
          jobId,
          weekStarting: week,
          weekEnding: sundayOfWeek(week),
          payrollNumber: Number(payrollNumber || '1'),
          projectNumber: job?.projectName ?? undefined,
          awardingAgency: job?.ownerAgency ?? undefined,
          rows: rows.length > 0 ? rows : undefined,
        },
      );
      router.push(`/certified-payrolls/${res.certifiedPayroll.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(t('newCpr.errHttp', { msg: err.message, status: err.status }));
      else if (err instanceof Error) setError(err.message);
      else setError(t('newCpr.errUnknown'));
      setSaving(false);
    }
  }

  async function loadDraftFromTimeCards() {
    setDraftError(null);
    setDraftRows([]);
    if (!jobId) {
      setDraftError('Pick a job first.');
      return;
    }
    const week = mondayOfWeek(weekStarting);
    setDraftBusy(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const [tcRes, empRes] = await Promise.all([
        fetch(`${apiBase}/api/time-cards`, { cache: 'no-store' }),
        fetch(`${apiBase}/api/employees`, { cache: 'no-store' }),
      ]);
      if (!tcRes.ok || !empRes.ok) {
        setDraftError('Could not load time cards or employees.');
        return;
      }
      const tcJson = (await tcRes.json()) as { timeCards: TimeCard[] };
      const empJson = (await empRes.json()) as { employees: Employee[] };
      const rows = buildDraftCprRows({
        jobId,
        weekStarting: week,
        timeCards: tcJson.timeCards ?? [],
        employees: empJson.employees ?? [],
      });
      if (rows.length === 0) {
        setDraftError(`No time-card hours found for this job + the week of ${week}.`);
      }
      setDraftRows(rows);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDraftBusy(false);
    }
  }

  function draftToCprRow(d: DraftCprRow): CprEmployeeRow {
    return {
      employeeId: d.employeeId,
      name: d.name,
      classification: d.classification,
      classificationOverride: undefined,
      ssnLast4: undefined,
      dailyHours: d.dailyHours,
      straightHours: d.straightHours,
      overtimeHours: d.overtimeHours + d.doubleTimeHours,
      hourlyRateCents: 0,
      fringeRateCents: 0,
      grossPayCents: 0,
      deductionsCents: 0,
      netPayCents: 0,
      note: d.hasOtherJobHours ? 'Employee also worked other jobs this week.' : undefined,
    };
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6">
        <Link href="/certified-payrolls" className="text-sm text-yge-blue-500 hover:underline">
          {t('newCpr.back')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newCpr.title')}</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Field label={t('newCpr.lblJob')}>
          <select
            required
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('newCpr.pickJob')}</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.projectName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('newCpr.lblWeekStarting')}>
          <input
            type="date"
            value={weekStarting}
            onChange={(e) => setWeekStarting(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('newCpr.weekHint')}
          </p>
        </Field>
        <Field label={t('newCpr.lblPayrollNumber')}>
          <input
            type="number"
            min="1"
            value={payrollNumber}
            onChange={(e) => setPayrollNumber(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <Alert tone="danger">{error}</Alert>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Pre-fill rows from time cards
            </h2>
            <button
              type="button"
              onClick={loadDraftFromTimeCards}
              disabled={draftBusy || !jobId}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {draftBusy ? 'Loading…' : 'Load draft from time cards'}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Reads the time cards for the chosen job + week of {mondayOfWeek(weekStarting)},
            applies CA §510 OT splits, returns one row per employee. Rates start at $0 — fill those
            in on the detail editor after creating the CPR.
          </p>
          {draftError && (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{draftError}</p>
          )}
          {draftRows.length > 0 && (
            <div className="mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-1">Employee</th>
                    <th className="py-1">Class</th>
                    <th className="py-1 text-right">ST</th>
                    <th className="py-1 text-right">OT</th>
                    <th className="py-1 text-right">DT</th>
                    <th className="py-1">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {draftRows.map((r) => (
                    <tr key={r.employeeId} className="border-t border-gray-200">
                      <td className="py-1 font-medium text-gray-900">{r.name}</td>
                      <td className="py-1 font-mono text-[10px] text-gray-700">{r.classification}</td>
                      <td className="py-1 text-right font-mono">{r.straightHours.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">{r.overtimeHours.toFixed(2)}</td>
                      <td className="py-1 text-right font-mono">{r.doubleTimeHours.toFixed(2)}</td>
                      <td className="py-1 text-xs text-gray-600">
                        {r.hasOtherJobHours ? 'Also worked other jobs this week' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-500">
                {draftRows.length} row{draftRows.length === 1 ? '' : 's'} will be created with the CPR.
                DT hours are merged into OT for the CPR record (the WH-347 form uses a single OT bucket).
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
          >
            {saving ? t('newCpr.busy') : t('newCpr.action')}
          </button>
          <Link href="/certified-payrolls" className="text-sm text-gray-600 hover:underline">
            {t('newCpr.cancel')}
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
