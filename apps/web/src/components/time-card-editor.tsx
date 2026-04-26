'use client';

// Time card editor — weekly entries with overtime rollup.

import { useState } from 'react';
import {
  entryWorkedHours,
  fullName,
  hoursByDate,
  hoursByJob,
  overtimeHoursThisWeek,
  timeCardStatusLabel,
  totalCardHours,
  type Employee,
  type Job,
  type TimeCard,
  type TimeCardStatus,
  type TimeEntry,
} from '@yge/shared';

const STATUSES: TimeCardStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED'];

interface Props {
  initial: TimeCard;
  employees: Employee[];
  jobs: Job[];
  apiBaseUrl: string;
}

export function TimeCardEditor({ initial, employees, jobs, apiBaseUrl }: Props) {
  const [card, setCard] = useState<TimeCard>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New entry form.
  const [entryDate, setEntryDate] = useState(card.weekStarting);
  const [entryJobId, setEntryJobId] = useState(jobs[0]?.id ?? '');
  const [entryStart, setEntryStart] = useState('07:00');
  const [entryEnd, setEntryEnd] = useState('15:30');
  const [entryLunchOut, setEntryLunchOut] = useState('11:30');
  const [entryLunchIn, setEntryLunchIn] = useState('12:00');
  const [entryCostCode, setEntryCostCode] = useState('');
  const [entryNote, setEntryNote] = useState('');

  const [notes, setNotes] = useState(card.notes ?? '');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/time-cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { timeCard: TimeCard };
      setCard(json.timeCard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function addEntry() {
    if (!entryJobId || !entryDate || !entryStart || !entryEnd) {
      setError('Date, job, start, and end are required.');
      return;
    }
    const next: TimeEntry = {
      date: entryDate,
      jobId: entryJobId,
      startTime: entryStart,
      endTime: entryEnd,
      ...(entryLunchOut ? { lunchOut: entryLunchOut } : {}),
      ...(entryLunchIn ? { lunchIn: entryLunchIn } : {}),
      ...(entryCostCode.trim() ? { costCode: entryCostCode.trim() } : {}),
      ...(entryNote.trim() ? { note: entryNote.trim() } : {}),
    };
    void patch({ entries: [...card.entries, next] });
  }

  function removeEntry(i: number) {
    void patch({ entries: card.entries.filter((_, idx) => idx !== i) });
  }

  const emp = employees.find((e) => e.id === card.employeeId);
  const total = totalCardHours(card);
  const ot = overtimeHoursThisWeek(card);
  const byJob = hoursByJob(card);
  const byDate = hoursByDate(card);
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Week of {card.weekStarting}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-yge-blue-500">
            {emp ? fullName(emp) : card.employeeId}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {total.toFixed(2)} hr total
            {ot.dailyOvertimeHours > 0 && (
              <>
                {' '}\u00b7 {ot.dailyOvertimeHours.toFixed(2)} hr daily OT
              </>
            )}
            {ot.weeklyOvertimeHours > 0 && (
              <>
                {' '}\u00b7 {ot.weeklyOvertimeHours.toFixed(2)} hr weekly OT
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={card.status}
            onChange={(e) => void patch({ status: e.target.value as TimeCardStatus })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {timeCardStatusLabel(s)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">Saving&hellip;</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Daily summary */}
      {byDate.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            Daily summary
          </h2>
          <ul className="grid grid-cols-7 gap-1 text-center text-xs">
            {byDate.map((d) => (
              <li
                key={d.date}
                className={`rounded border px-2 py-2 ${d.hours > 8 ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="text-[10px] text-gray-500">{d.date.slice(5)}</div>
                <div className="font-bold">{d.hours.toFixed(2)}</div>
                {d.hours > 8 && (
                  <div className="text-[10px] text-orange-700">
                    +{(d.hours - 8).toFixed(2)} OT
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* By job */}
      {byJob.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
            By job
          </h2>
          <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white text-sm">
            {byJob.map((j) => {
              const job = jobById.get(j.jobId);
              return (
                <li key={j.jobId} className="flex items-center justify-between px-4 py-2">
                  <span>{job ? job.projectName : j.jobId}</span>
                  <span className="font-mono tabular-nums">{j.hours.toFixed(2)} hr</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Entry add */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Add entry</h2>
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-7">
            <Field label="Date">
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Job">
              <select
                value={entryJobId}
                onChange={(e) => setEntryJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.projectName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start">
              <input
                type="time"
                value={entryStart}
                onChange={(e) => setEntryStart(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Lunch out">
              <input
                type="time"
                value={entryLunchOut}
                onChange={(e) => setEntryLunchOut(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Lunch in">
              <input
                type="time"
                value={entryLunchIn}
                onChange={(e) => setEntryLunchIn(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={entryEnd}
                onChange={(e) => setEntryEnd(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <div className="self-end">
              <button
                type="button"
                onClick={addEntry}
                className="w-full rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
              >
                Add
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Field label="Cost code (optional)">
              <input
                value={entryCostCode}
                onChange={(e) => setEntryCostCode(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
              />
            </Field>
            <Field label="Note">
              <input
                value={entryNote}
                onChange={(e) => setEntryNote(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Entry list */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Entries</h2>
        {card.entries.length === 0 ? (
          <p className="text-sm text-gray-500">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white text-sm">
            {[...card.entries]
              .map((e, i) => ({ e, i }))
              .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.e.startTime.localeCompare(b.e.startTime))
              .map(({ e, i }) => {
                const job = jobById.get(e.jobId);
                const hours = entryWorkedHours(e);
                return (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                    <div>
                      <div className="font-medium text-gray-900">
                        {e.date} &middot; {job ? job.projectName : e.jobId}
                      </div>
                      <div className="text-xs text-gray-500">
                        {e.startTime}–{e.endTime}
                        {e.lunchOut && e.lunchIn && (
                          <>
                            {' '} (lunch {e.lunchOut}–{e.lunchIn})
                          </>
                        )}
                        {e.costCode && (
                          <>
                            {' '} \u00b7 cost code {e.costCode}
                          </>
                        )}
                        {e.note && (
                          <>
                            {' '} \u00b7 {e.note}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-mono font-medium tabular-nums">
                        {hours.toFixed(2)} hr
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEntry(i)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <Field label="Notes">
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void patch({ notes: notes.trim() || undefined })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Field>
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
