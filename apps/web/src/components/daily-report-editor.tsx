'use client';

// Daily report editor — client island for /daily-reports/[id].
//
// Manages the crew rows + free-form text fields, surfaces meal-break
// violations inline, and runs the dedicated /submit endpoint when the
// foreman hits "Submit report". Submission is refused with a 409 if any
// non-waived violation exists; the violations are reflected back into the
// UI so the foreman can either fix the times or add a written waiver.

import { useMemo, useState } from 'react';
import { useTranslator, useLocale } from '../lib/use-translator';
import {
  crewRowViolations,
  crewRowWorkedHours,
  fullName,
  reportViolations,
  totalReportHours,
  violationLabel,
  type DailyReport,
  type DailyReportCrewRow,
  type Employee,
  type Job,
} from '@yge/shared';

interface Props {
  initial: DailyReport;
  employees: Employee[];
  jobs: Job[];
  apiBaseUrl: string;
}

export function DailyReportEditor({ initial, employees, jobs, apiBaseUrl }: Props) {
  const t = useTranslator();
  const locale = useLocale();
  const [report, setReport] = useState<DailyReport>(initial);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );
  const job = useMemo(
    () => jobs.find((j) => j.id === report.jobId),
    [jobs, report.jobId],
  );
  const foreman = empById.get(report.foremanId);

  // Local mirrors of the free-form fields so onBlur PATCH doesn't fight the
  // user's typing.
  const [weather, setWeather] = useState(report.weather ?? '');
  const [tempStr, setTempStr] = useState(
    report.temperatureF !== undefined ? String(report.temperatureF) : '',
  );
  const [scopeCompleted, setScopeCompleted] = useState(report.scopeCompleted ?? '');
  const [issues, setIssues] = useState(report.issues ?? '');
  const [visitors, setVisitors] = useState(report.visitors ?? '');
  const [subsOnSite, setSubsOnSite] = useState(report.subsOnSite ?? '');
  const [materialsConsumed, setMaterialsConsumed] = useState(
    report.materialsConsumed ?? '',
  );
  const [nextDayPlan, setNextDayPlan] = useState(report.nextDayPlan ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/daily-reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('dre.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { report: DailyReport };
      setReport(json.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dre.errFallback'));
    } finally {
      setSaving(false);
    }
  }

  function saveText() {
    void patch({
      weather: weather.trim() || undefined,
      temperatureF: tempStr.trim() ? Number(tempStr) : undefined,
      scopeCompleted: scopeCompleted.trim() || undefined,
      issues: issues.trim() || undefined,
      visitors: visitors.trim() || undefined,
      subsOnSite: subsOnSite.trim() || undefined,
      materialsConsumed: materialsConsumed.trim() || undefined,
      nextDayPlan: nextDayPlan.trim() || undefined,
    });
  }

  function addCrewRow() {
    const next: DailyReportCrewRow = {
      employeeId: employees[0]?.id ?? '',
      startTime: '07:00',
      endTime: '15:30',
    };
    void patch({ crewOnSite: [...report.crewOnSite, next] });
  }

  function removeCrewRow(i: number) {
    const next = report.crewOnSite.filter((_, idx) => idx !== i);
    void patch({ crewOnSite: next });
  }

  function updateCrewRow(i: number, partial: Partial<DailyReportCrewRow>) {
    const next = report.crewOnSite.map((r, idx) =>
      idx === i ? { ...r, ...partial } : r,
    );
    void patch({ crewOnSite: next });
  }

  async function submitReport() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/daily-reports/${report.id}/submit`, {
        method: 'POST',
      });
      if (res.status === 409) {
        // The violations are also surfaced inline next to each crew row, so
        // we don't need to parse the body — just give the foreman the gist.
        setError(t('dre.errSubmitBlocked'));
        return;
      }
      if (!res.ok) throw new Error(t('dre.errSubmitStatus', { status: res.status }));
      const json = (await res.json()) as { report: DailyReport };
      setReport(json.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dre.errSubmitFallback'));
    } finally {
      setSubmitting(false);
    }
  }

  const total = totalReportHours(report);
  const violatedRows = reportViolations(report);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-yge-blue-500">
            {t('dre.heading', { date: report.date })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {job ? job.projectName : report.jobId}
            {foreman && t('dre.foremanSuffix', { name: fullName(foreman) })}
            {t('dre.totalSuffix', { hr: total.toFixed(2) })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {report.submitted ? (
            <span className="rounded bg-green-100 px-2 py-1 font-semibold uppercase tracking-wide text-green-800">
              {t('dre.submitted')}
            </span>
          ) : (
            <button
              type="button"
              onClick={submitReport}
              disabled={submitting}
              className="rounded bg-yge-blue-500 px-3 py-1 font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {submitting ? t('dre.submitting') : t('dre.submit')}
            </button>
          )}
          {saving && <span className="text-gray-500">{t('dre.saving')}</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {violatedRows.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>{t('dre.violationsLeader', { count: violatedRows.length })}</strong>{t('dre.violationsBody')}
        </div>
      )}

      {/* Weather + temp */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={t('dre.lblWeather')}>
          <input
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            onBlur={saveText}
            placeholder={t('dre.phWeather')}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('dre.lblTemp')}>
          <input
            type="number"
            value={tempStr}
            onChange={(e) => setTempStr(e.target.value)}
            onBlur={saveText}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Crew rows */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('dre.crewHeader')}</h2>
          <button
            type="button"
            onClick={addCrewRow}
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            {t('dre.addCrewRow')}
          </button>
        </div>

        {report.crewOnSite.length === 0 ? (
          <p className="text-sm text-gray-500">{t('dre.crewEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {report.crewOnSite.map((row, i) => {
              const violations = crewRowViolations(row);
              const hasWaiver = !!row.mealBreakWaiverNote;
              const showRed = violations.length > 0 && !hasWaiver;
              return (
                <li
                  key={i}
                  className={`rounded border p-3 text-sm ${showRed ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                >
                  <div className="grid gap-3 sm:grid-cols-6">
                    <Field label={t('dre.lblEmployee')}>
                      <select
                        value={row.employeeId}
                        onChange={(e) =>
                          updateCrewRow(i, { employeeId: e.target.value })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        {employees
                          .filter((e) => e.status === 'ACTIVE')
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {fullName(e)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <TimeField
                      label={t('dre.lblStart')}
                      value={row.startTime}
                      onChange={(v) => updateCrewRow(i, { startTime: v })}
                    />
                    <TimeField
                      label={t('dre.lblLunchOut')}
                      value={row.lunchOut ?? ''}
                      onChange={(v) =>
                        updateCrewRow(i, { lunchOut: v || undefined })
                      }
                    />
                    <TimeField
                      label={t('dre.lblLunchIn')}
                      value={row.lunchIn ?? ''}
                      onChange={(v) =>
                        updateCrewRow(i, { lunchIn: v || undefined })
                      }
                    />
                    <TimeField
                      label={t('dre.lblEnd')}
                      value={row.endTime}
                      onChange={(v) => updateCrewRow(i, { endTime: v })}
                    />
                    <div className="self-end pb-1 text-right text-xs text-gray-700">
                      <div>{t('dre.rowHours', { hr: crewRowWorkedHours(row).toFixed(2) })}</div>
                      <button
                        type="button"
                        onClick={() => removeCrewRow(i)}
                        className="mt-1 text-red-600 hover:underline"
                      >
                        {t('dre.removeRow')}
                      </button>
                    </div>
                  </div>

                  {(row.secondMealOut || row.secondMealIn || violations.some((v) => v.kind === 'second-meal-missing')) && (
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <TimeField
                        label={t('dre.lblSecondMealOut')}
                        value={row.secondMealOut ?? ''}
                        onChange={(v) =>
                          updateCrewRow(i, { secondMealOut: v || undefined })
                        }
                      />
                      <TimeField
                        label={t('dre.lblSecondMealIn')}
                        value={row.secondMealIn ?? ''}
                        onChange={(v) =>
                          updateCrewRow(i, { secondMealIn: v || undefined })
                        }
                      />
                    </div>
                  )}

                  {violations.length > 0 && (
                    <div className="mt-2 text-xs text-red-700">
                      <ul className="list-inside list-disc">
                        {violations.map((v, j) => (
                          <li key={j}>{violationLabel(v, locale)}</li>
                        ))}
                      </ul>
                      <Field label={t('dre.lblWaiver')}>
                        <input
                          value={row.mealBreakWaiverNote ?? ''}
                          onChange={(e) =>
                            updateCrewRow(i, {
                              mealBreakWaiverNote: e.target.value || undefined,
                            })
                          }
                          placeholder={t('dre.phWaiver')}
                          className="w-full rounded border border-red-300 bg-white px-2 py-1 text-sm"
                        />
                      </Field>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Free-form sections */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('dre.lblScopeCompleted')}>
          <textarea
            rows={4}
            value={scopeCompleted}
            onChange={(e) => setScopeCompleted(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('dre.lblIssues')}>
          <textarea
            rows={4}
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('dre.lblVisitors')}>
          <textarea
            rows={2}
            value={visitors}
            onChange={(e) => setVisitors(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('dre.lblSubsOnSite')}>
          <textarea
            rows={2}
            value={subsOnSite}
            onChange={(e) => setSubsOnSite(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('dre.lblMaterials')}>
          <textarea
            rows={3}
            value={materialsConsumed}
            onChange={(e) => setMaterialsConsumed(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('dre.lblNextDay')}>
          <textarea
            rows={3}
            value={nextDayPlan}
            onChange={(e) => setNextDayPlan(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>
    </div>
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

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      />
    </Field>
  );
}
