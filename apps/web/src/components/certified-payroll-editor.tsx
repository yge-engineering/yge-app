'use client';

import { useState } from 'react';
import { useTranslator } from '../lib/use-translator';
import {
  classificationLabel,
  computeRowPay,
  cprStatusLabel,
  cprSubmitBlockers,
  formatUSD,
  fullName,
  totalRowHours,
  type CertifiedPayroll,
  type CprEmployeeRow,
  type CprStatus,
  type DirClassification,
  type Employee,
  type Job,
} from '@yge/shared';

const STATUSES: CprStatus[] = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'AMENDED', 'NON_PERFORMANCE'];
const DAY_KEYS = ['cpr.dayMon', 'cpr.dayTue', 'cpr.dayWed', 'cpr.dayThu', 'cpr.dayFri', 'cpr.daySat', 'cpr.daySun'];

interface Props {
  initial: CertifiedPayroll;
  employees: Employee[];
  jobs: Job[];
  apiBaseUrl: string;
}

export function CertifiedPayrollEditor({ initial, employees, jobs, apiBaseUrl }: Props) {
  const t = useTranslator();
  const [cpr, setCpr] = useState<CertifiedPayroll>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  // Add-row form.
  const [newEmpId, setNewEmpId] = useState(employees[0]?.id ?? '');
  const [newSsnLast4, setNewSsnLast4] = useState('');
  const [newDays, setNewDays] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [newRateDollars, setNewRateDollars] = useState('');
  const [newFringeDollars, setNewFringeDollars] = useState('');

  const job = jobs.find((j) => j.id === cpr.jobId);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/certified-payrolls/${cpr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('cpr.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { certifiedPayroll: CertifiedPayroll };
      setCpr(json.certifiedPayroll);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cpr.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function addRow() {
    const emp = employees.find((e) => e.id === newEmpId);
    if (!emp) {
      setError(t('cpr.errPickEmployee'));
      return;
    }
    const total = newDays.reduce((a, b) => a + b, 0);
    const straight = Math.min(total, 40);
    const overtime = Math.max(0, total - 40);
    const rateCents = Math.round(Number(newRateDollars || '0') * 100);
    const fringeCents = Math.round(Number(newFringeDollars || '0') * 100);
    const pay = computeRowPay({
      straightHours: straight,
      overtimeHours: overtime,
      hourlyRateCents: rateCents,
      fringeRateCents: fringeCents,
    });
    const row: CprEmployeeRow = {
      employeeId: emp.id,
      name: fullName(emp),
      classification: emp.classification,
      ssnLast4: newSsnLast4 || undefined,
      dailyHours: newDays,
      straightHours: straight,
      overtimeHours: overtime,
      hourlyRateCents: rateCents,
      fringeRateCents: fringeCents,
      grossPayCents: pay.grossPayCents,
      deductionsCents: 0,
      netPayCents: pay.grossPayCents,
    };
    void patch({ rows: [...cpr.rows, row] });
    setNewSsnLast4('');
    setNewDays([0, 0, 0, 0, 0, 0, 0]);
    setNewRateDollars('');
    setNewFringeDollars('');
  }

  function removeRow(i: number) {
    void patch({ rows: cpr.rows.filter((_, idx) => idx !== i) });
  }

  async function submit() {
    setSubmitMsg(null);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/certified-payrolls/${cpr.id}/submit`, {
        method: 'POST',
      });
      if (res.status === 409) {
        const body = (await res.json()) as { blockers?: string[] };
        setError(t('cpr.errSubmissionBlocked', { reasons: (body.blockers ?? []).join('; ') }));
        return;
      }
      if (!res.ok) throw new Error(t('cpr.errSubmitStatus', { status: res.status }));
      const json = (await res.json()) as { certifiedPayroll: CertifiedPayroll };
      setCpr(json.certifiedPayroll);
      setSubmitMsg(t('cpr.submittedOk'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cpr.errSubmitFallback'));
    } finally {
      setSaving(false);
    }
  }

  const blockers = cprSubmitBlockers(cpr);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-wide text-gray-500">
            {t('cpr.heading', { number: cpr.payrollNumber })}
            {cpr.isFinalPayroll && <span className="ml-2 text-orange-700">{t('cprEditor.final')}</span>}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">
            {job ? job.projectName : cpr.jobId}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('cpr.weekRange', { start: cpr.weekStarting, end: cpr.weekEnding })}
            {cpr.projectNumber && t('cpr.projNumSuffix', { number: cpr.projectNumber })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={cpr.status}
            onChange={(e) => void patch({ status: e.target.value as CprStatus })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {cprStatusLabel(s)}
              </option>
            ))}
          </select>
          {cpr.status === 'DRAFT' && (
            <button
              type="button"
              onClick={submit}
              disabled={blockers.length > 0}
              className="rounded bg-yge-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
              title={blockers.length > 0 ? blockers.join('\n') : t('cpr.submitTip')}
            >
              {t('cpr.submit')}
            </button>
          )}
          {saving && <span className="text-gray-500">{t('cpr.saving')}</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {submitMsg && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {submitMsg}
        </div>
      )}

      {blockers.length > 0 && cpr.status === 'DRAFT' && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          <strong>{t('cpr.blockersTitle')}</strong>
          <ul className="ml-4 list-disc">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={cpr.complianceStatementSigned}
            onChange={(e) => void patch({ complianceStatementSigned: e.target.checked })}
            className="h-4 w-4"
          />
          {t('cpr.complianceSigned')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={cpr.isFinalPayroll}
            onChange={(e) => void patch({ isFinalPayroll: e.target.checked })}
            className="h-4 w-4"
          />
          {t('cpr.finalPayroll')}
        </label>
      </section>

      {/* Add row */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('cpr.addRowHeader')}</h2>
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Field label={t('cpr.lblEmployee')}>
              <select
                value={newEmpId}
                onChange={(e) => setNewEmpId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {fullName(e)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('cpr.lblSsn')}>
              <input
                value={newSsnLast4}
                onChange={(e) => setNewSsnLast4(e.target.value.slice(0, 4))}
                maxLength={4}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
              />
            </Field>
            <Field label={t('cpr.lblHourlyRate')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newRateDollars}
                onChange={(e) => setNewRateDollars(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('cpr.lblFringe')}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newFringeDollars}
                onChange={(e) => setNewFringeDollars(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {DAY_KEYS.map((dKey, i) => (
              <Field key={dKey} label={t(dKey)}>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={newDays[i]}
                  onChange={(e) => {
                    const v = Number(e.target.value || '0');
                    setNewDays(newDays.map((x, idx) => (idx === i ? v : x)));
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </Field>
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={addRow}
              className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
            >
              {t('cpr.addRow')}
            </button>
          </div>
        </div>
      </section>

      {/* Rows */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('cpr.payrollRowsHeader')}</h2>
        {cpr.rows.length === 0 ? (
          <p className="text-sm text-gray-500">{t('cpr.empty')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-2">{t('cpr.thName')}</th>
                <th className="py-2 pr-2">{t('cpr.thClassification')}</th>
                <th className="py-2 pr-2">M</th>
                <th className="py-2 pr-2">T</th>
                <th className="py-2 pr-2">W</th>
                <th className="py-2 pr-2">T</th>
                <th className="py-2 pr-2">F</th>
                <th className="py-2 pr-2">S</th>
                <th className="py-2 pr-2">S</th>
                <th className="py-2 pr-2">{t('cpr.thTotal')}</th>
                <th className="py-2 pr-2">{t('cpr.thStOt')}</th>
                <th className="py-2 pr-2">{t('cpr.thRate')}</th>
                <th className="py-2 pr-2">{t('cpr.thGross')}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cpr.rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2 align-top font-medium">{r.name}</td>
                  <td className="py-2 pr-2 align-top text-xs">
                    {classificationLabel(r.classification)}
                  </td>
                  {r.dailyHours.map((h, di) => (
                    <td key={di} className="py-2 pr-2 align-top tabular-nums">
                      {h > 0 ? h.toFixed(2) : '—'}
                    </td>
                  ))}
                  <td className="py-2 pr-2 align-top tabular-nums">{totalRowHours(r).toFixed(2)}</td>
                  <td className="py-2 pr-2 align-top text-xs tabular-nums">
                    {r.straightHours.toFixed(1)} / {r.overtimeHours.toFixed(1)}
                  </td>
                  <td className="py-2 pr-2 align-top tabular-nums">
                    {formatUSD(r.hourlyRateCents)}
                  </td>
                  <td className="py-2 pr-2 align-top font-medium tabular-nums">
                    {formatUSD(r.grossPayCents)}
                  </td>
                  <td className="py-2 align-top text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Field label={t('cpr.lblNotes')}>
        <textarea
          rows={3}
          defaultValue={cpr.notes ?? ''}
          onBlur={(e) => void patch({ notes: e.target.value.trim() || undefined })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
