'use client';

// /pw-deadlines — prevailing-wage deadline calendar.
//
// Wires bundle 2504's buildPwCalendar into a real office tool. The
// Job model doesn't yet store award date or per-craft lists, so this
// page is a calculator: paste / type the awarded jobs + their award
// dates + crafts, see the unified DAS-140 / PWC-100 / CPR deadline
// list with status badges and an actionable filter.
//
// A future bundle adds awardDate + crafts to the Job schema (additive
// migration) and pre-loads the table from the API.

import { useMemo, useState } from 'react';
import {
  PwAwardedJobSchema,
  actionableRows,
  buildPwCalendar,
  type PwAwardedJob,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SEED = `# Paste rows like:
# jobId, projectName, awardDate, crafts(semicolon-separated), cprStarted(y/n)
job-1, Sulphur Springs Soquol Rd, 2026-05-15, Operating Engineer;Laborer, n
job-2, Manton CSD Pipeline, 2026-04-01, Plumber, y`;

const STATUS_TONE = {
  PAST: 'bg-red-100 text-red-900',
  URGENT: 'bg-amber-100 text-amber-900',
  UPCOMING: 'bg-blue-100 text-blue-900',
} as const;

function parseJobsCsv(text: string): { jobs: PwAwardedJob[]; errors: string[] } {
  const jobs: PwAwardedJob[] = [];
  const errors: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('#'))
    .forEach((line, idx) => {
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 3) {
        errors.push(`Line ${idx + 1}: need at least jobId,projectName,awardDate`);
        return;
      }
      const [jobId, projectName, awardDate, craftsStr, cprStr] = cols;
      const crafts = (craftsStr ?? '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      const cprStarted = /^y(es)?$/i.test(cprStr ?? '');
      const parsed = PwAwardedJobSchema.safeParse({
        id: jobId,
        projectName,
        awardDate,
        crafts,
        cprStarted,
      });
      if (!parsed.success) {
        errors.push(`Line ${idx + 1}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
        return;
      }
      jobs.push(parsed.data);
    });
  return { jobs, errors };
}

export default function PwDeadlinesPage() {
  const [csv, setCsv] = useState(SEED);
  const [asOf, setAsOf] = useState(todayIso);
  const [urgentWithin, setUrgentWithin] = useState('3');
  const [actionableOnly, setActionableOnly] = useState(false);

  const { jobs, errors } = useMemo(() => parseJobsCsv(csv), [csv]);
  const rows = useMemo(() => {
    if (jobs.length === 0) return [];
    return buildPwCalendar({
      jobs,
      asOfDate: asOf,
      urgentWithinDays: Math.max(0, Number(urgentWithin) || 0),
    });
  }, [jobs, asOf, urgentWithin]);

  const display = actionableOnly ? actionableRows(rows) : rows;
  const pastCount = rows.filter((r) => r.status === 'PAST').length;
  const urgentCount = rows.filter((r) => r.status === 'URGENT').length;
  const upcomingCount = rows.filter((r) => r.status === 'UPCOMING').length;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="PW deadline calendar"
          subtitle="DAS-140 / PWC-100 / weekly CPR for awarded PW jobs. Status PAST / URGENT / UPCOMING based on the as-of date and the urgent window."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Awarded jobs (CSV)</h2>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-mono">jobId, projectName, awardDate, crafts(semi-sep), cprStarted(y/n)</span>.
              Lines starting with # are ignored. A future bundle pulls this from the Job table once an awardDate field lands.
            </p>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={10}
              className="mt-3 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
            />
            {errors.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-red-700">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Calculation</h2>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-gray-700">As of date</span>
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Urgent window (days)</span>
              <input
                type="number"
                min="0"
                value={urgentWithin}
                onChange={(e) => setUrgentWithin(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </label>

            <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={actionableOnly}
                onChange={(e) => setActionableOnly(e.target.checked)}
              />
              Show only actionable (PAST + URGENT)
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Tile label="PAST" value={String(pastCount)} />
              <Tile label="URGENT" value={String(urgentCount)} />
              <Tile label="UPCOMING" value={String(upcomingCount)} />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Deadlines ({display.length})
          </h2>
          {display.length === 0 ? (
            <p className="mt-2 text-sm text-gray-600">
              {jobs.length === 0
                ? 'No valid jobs in the CSV yet.'
                : 'No deadlines match the current filter.'}
            </p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2">Status</th>
                  <th className="py-2">Kind</th>
                  <th className="py-2">Project</th>
                  <th className="py-2">Craft</th>
                  <th className="py-2">Due</th>
                  <th className="py-2 text-right">Days</th>
                </tr>
              </thead>
              <tbody>
                {display.map((r, i) => (
                  <tr key={`${r.jobId}-${r.kind}-${r.craft ?? ''}-${i}`} className="border-t border-gray-200">
                    <td className="py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs text-gray-700">{r.kind}</td>
                    <td className="py-2 text-gray-900">{r.projectName}</td>
                    <td className="py-2 text-gray-700">{r.craft ?? '—'}</td>
                    <td className="py-2 font-mono text-xs">{r.dueDate}</td>
                    <td
                      className={`py-2 text-right font-mono ${
                        r.daysUntilDue < 0
                          ? 'text-red-700'
                          : r.daysUntilDue <= 3
                            ? 'text-amber-700'
                            : 'text-gray-700'
                      }`}
                    >
                      {r.daysUntilDue >= 0 ? `+${r.daysUntilDue}` : String(r.daysUntilDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </AppShell>
  );
}
