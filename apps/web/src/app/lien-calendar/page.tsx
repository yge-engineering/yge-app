'use client';

import { useState } from 'react';

import { AppShell, PageHeader, StatusPill, Tile } from '../../components';
import {
  computeLienDeadlines,
  summarizeLienCalendar,
  LienRightsInputSchema,
  type LienDeadline,
  type LienDeadlineStatus,
  type LienJobType,
} from '@yge/shared';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pillTone(status: LienDeadlineStatus): 'danger' | 'warn' | 'success' | 'neutral' {
  switch (status) {
    case 'PAST_DUE':
      return 'danger';
    case 'PENDING':
      return 'warn';
    case 'COMPLETED':
      return 'success';
    default:
      return 'neutral';
  }
}

function labelForType(t: LienDeadline['type']): string {
  switch (t) {
    case 'PRELIMINARY_20_DAY':
      return '20-day preliminary notice (§8200)';
    case 'MECHANICS_LIEN_90_DAY':
      return "Mechanic's lien — 90 days from last work (§8412)";
    case 'MECHANICS_LIEN_POST_NOC':
      return "Mechanic's lien — post-NOC window (§8412)";
    case 'RETENTION_RELEASE_60_DAY':
      return 'Retention release — 60 days (§7107)';
  }
}

export default function LienCalendarPage() {
  const [jobId, setJobId] = useState('job-' + Math.random().toString(36).slice(2, 10));
  const [jobName, setJobName] = useState('');
  const [jobType, setJobType] = useState<LienJobType>('PUBLIC');
  const [isSubTier, setIsSubTier] = useState(true);
  const [firstWorkDate, setFirstWorkDate] = useState('');
  const [lastWorkDate, setLastWorkDate] = useState('');
  const [ncDate, setNcDate] = useState('');
  const [prelimNoticeServed, setPrelimNoticeServed] = useState(false);
  const [prelimNoticeDate, setPrelimNoticeDate] = useState('');
  const [lienRecordedDate, setLienRecordedDate] = useState('');
  const [retentionReleasedDate, setRetentionReleasedDate] = useState('');
  const [today, setToday] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [deadlines, setDeadlines] = useState<LienDeadline[] | null>(null);

  function compute() {
    setError(null);
    if (!jobName.trim()) {
      setError('Job name is required.');
      return;
    }
    const parsed = LienRightsInputSchema.safeParse({
      jobId,
      jobName: jobName.trim(),
      jobType,
      isSubTier,
      firstWorkDate: firstWorkDate || undefined,
      lastWorkDate: lastWorkDate || undefined,
      ncDate: ncDate || undefined,
      prelimNoticeServed,
      prelimNoticeDate: prelimNoticeDate || undefined,
      lienRecordedDate: lienRecordedDate || undefined,
      retentionReleasedDate: retentionReleasedDate || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input.');
      return;
    }
    setDeadlines(computeLienDeadlines(parsed.data, today));
  }

  const summary = deadlines ? summarizeLienCalendar(deadlines) : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl p-8">
        <PageHeader
          title="Lien rights calendar"
          subtitle="Enter the key dates for a job and we compute the California mechanics-lien and prompt-pay deadlines. CA Civ. Code §8200 (20-day prelim), §8412 (lien clock), and §7107 (retention release on public works)."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Job</h2>
            <div className="space-y-3 text-sm">
              <Field label="Job name">
                <input
                  required
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g. Sulphur Springs"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Job type">
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value as LienJobType)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="PUBLIC">Public works</option>
                    <option value="PRIVATE">Private</option>
                  </select>
                </Field>
                <Field label="YGE position">
                  <select
                    value={isSubTier ? 'sub' : 'direct'}
                    onChange={(e) => setIsSubTier(e.target.value === 'sub')}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="sub">Sub-tier / second-tier</option>
                    <option value="direct">Direct (prime)</option>
                  </select>
                </Field>
              </div>
              <Field label="Today (for status calc)">
                <input
                  type="date"
                  value={today}
                  onChange={(e) => setToday(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">Key dates</h2>
            <div className="space-y-3 text-sm">
              <Field label="First work date">
                <input
                  type="date"
                  value={firstWorkDate}
                  onChange={(e) => setFirstWorkDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Last work date">
                <input
                  type="date"
                  value={lastWorkDate}
                  onChange={(e) => setLastWorkDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Notice of Completion / Cessation recorded">
                <input
                  type="date"
                  value={ncDate}
                  onChange={(e) => setNcDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              <hr className="border-gray-200" />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prelimNoticeServed}
                  onChange={(e) => setPrelimNoticeServed(e.target.checked)}
                />
                <span className="text-sm">20-day preliminary notice served</span>
              </label>
              {prelimNoticeServed ? (
                <Field label="Prelim notice date">
                  <input
                    type="date"
                    value={prelimNoticeDate}
                    onChange={(e) => setPrelimNoticeDate(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
              ) : null}
              <Field label="Lien recorded">
                <input
                  type="date"
                  value={lienRecordedDate}
                  onChange={(e) => setLienRecordedDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </Field>
              {jobType === 'PUBLIC' ? (
                <Field label="Retention released">
                  <input
                    type="date"
                    value={retentionReleasedDate}
                    onChange={(e) => setRetentionReleasedDate(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </Field>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={compute}
            className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
          >
            Compute deadlines
          </button>
          {error ? <span className="text-sm text-red-700">{error}</span> : null}
        </div>

        {summary ? (
          <section className="mt-6 grid gap-3 sm:grid-cols-4">
            <Tile label="Past due" value={summary.pastDue} tone={summary.pastDue > 0 ? 'warn' : 'success'} />
            <Tile label="Due within 30d" value={summary.dueWithin30} tone={summary.dueWithin30 > 0 ? 'warn' : 'success'} />
            <Tile label="Completed" value={summary.completed} />
            <Tile label="Total" value={summary.totalDeadlines} />
          </section>
        ) : null}

        {deadlines ? (
          <section className="mt-4 overflow-hidden rounded-md border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Deadline</th>
                  <th className="px-4 py-2 text-left font-semibold">Due</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deadlines.map((d) => (
                  <tr key={d.type} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="text-sm font-medium text-gray-900">{labelForType(d.type)}</div>
                      <div className="mt-0.5 text-xs text-gray-600">{d.description}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-sm">{d.dueDate}</td>
                    <td className="px-4 py-2">
                      <StatusPill label={d.status.replace(/_/g, ' ')} tone={pillTone(d.status)} />
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm">
                      {d.daysUntilDue >= 0 ? `+${d.daysUntilDue}` : d.daysUntilDue}
                    </td>
                  </tr>
                ))}
                {deadlines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm text-gray-600">
                      No deadlines computed yet — fill in at least the first work date and re-run.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        ) : null}
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
