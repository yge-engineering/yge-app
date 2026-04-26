'use client';

// Daily report editor — client island for /daily-reports/[id].
//
// Manages the crew rows + free-form text fields, surfaces meal-break
// violations inline, and runs the dedicated /submit endpoint when the
// foreman hits "Submit report". Submission is refused with a 409 if any
// non-waived violation exists; the violations are reflected back into the
// UI so the foreman can either fix the times or add a written waiver.

import { useMemo, useState } from 'react';
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
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { report: DailyReport };
      setReport(json.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
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
        setError(
          'Submission blocked by meal-break violations. Fix the times or add a waiver note on the affected rows.',
        );
        return;
      }
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      const json = (await res.json()) as { report: DailyReport };
      setReport(json.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
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
            Daily report &mdash; {report.date}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {job ? job.projectName : report.jobId}
            {foreman && (
              <>
                {' '}&middot; Foreman: {fullName(foreman)}
              </>
            )}
            {' '}&middot; Total: {total.toFixed(2)} hr
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {report.submitted ? (
            <span className="rounded bg-green-100 px-2 py-1 font-semibold uppercase tracking-wide text-green-800">
              Submitted
            </span>
          ) : (
            <button
              type="button"
              onClick={submitReport}
              disabled={submitting}
              className="rounded bg-yge-blue-500 px-3 py-1 font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting\u2026' : 'Submit report'}
            </button>
          )}
          {saving && <span className="text-gray-500">Saving&hellip;</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {violatedRows.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong>Meal-break violations on {violatedRows.length} row(s).</strong>{' '}
          California Labor Code 512 requires a 30-minute meal break before the
          6th hour, plus a second one before the 11th hour for shifts over 10
          hours. Either fix the times below or add a written waiver note on
          the affected row.
        </div>
      )}

      {/* Weather + temp */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Weather">
          <input
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            onBlur={saveText}
            placeholder="Clear, hot, gusty"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Temperature (°F)">
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
          <h2 className="text-lg font-semibold text-gray-900">Crew on site</h2>
          <button
            type="button"
            onClick={addCrewRow}
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + Add crew row
          </button>
        </div>

        {report.crewOnSite.length === 0 ? (
          <p className="text-sm text-gray-500">No crew added yet.</p>
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
                    <Field label="Employee">
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
                      label="Start"
                      value={row.startTime}
                      onChange={(v) => updateCrewRow(i, { startTime: v })}
                    />
                    <TimeField
                      label="Lunch out"
                      value={row.lunchOut ?? ''}
                      onChange={(v) =>
                        updateCrewRow(i, { lunchOut: v || undefined })
                      }
                    />
                    <TimeField
                      label="Lunch in"
                      value={row.lunchIn ?? ''}
                      onChange={(v) =>
                        updateCrewRow(i, { lunchIn: v || undefined })
                      }
                    />
                    <TimeField
                      label="End"
                      value={row.endTime}
                      onChange={(v) => updateCrewRow(i, { endTime: v })}
                    />
                    <div className="self-end pb-1 text-right text-xs text-gray-700">
                      <div>{crewRowWorkedHours(row).toFixed(2)} hr</div>
                      <button
                        type="button"
                        onClick={() => removeCrewRow(i)}
                        className="mt-1 text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {(row.secondMealOut || row.secondMealIn || violations.some((v) => v.kind === 'second-meal-missing')) && (
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <TimeField
                        label="2nd meal out"
                        value={row.secondMealOut ?? ''}
                        onChange={(v) =>
                          updateCrewRow(i, { secondMealOut: v || undefined })
                        }
                      />
                      <TimeField
                        label="2nd meal in"
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
                          <li key={j}>{violationLabel(v)}</li>
                        ))}
                      </ul>
                      <Field label="Waiver note (resolves all violations on this row)">
                        <input
                          value={row.mealBreakWaiverNote ?? ''}
                          onChange={(e) =>
                            updateCrewRow(i, {
                              mealBreakWaiverNote: e.target.value || undefined,
                            })
                          }
                          placeholder='e.g. "Employee signed waiver — on file."'
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
        <Field label="Scope completed">
          <textarea
            rows={4}
            value={scopeCompleted}
            onChange={(e) => setScopeCompleted(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Issues / delays / accidents">
          <textarea
            rows={4}
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Visitors (inspector, owner, etc.)">
          <textarea
            rows={2}
            value={visitors}
            onChange={(e) => setVisitors(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Subcontractors on site">
          <textarea
            rows={2}
            value={subsOnSite}
            onChange={(e) => setSubsOnSite(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Materials consumed">
          <textarea
            rows={3}
            value={materialsConsumed}
            onChange={(e) => setMaterialsConsumed(e.target.value)}
            onBlur={saveText}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Next day's plan">
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
