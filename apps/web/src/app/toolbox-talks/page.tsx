// /toolbox-talks — Cal/OSHA T8 §1509 weekly safety meeting tracker.

import Link from 'next/link';
import {
  computeToolboxTalkRollup,
  signedAttendeeCount,
  toolboxTalkStatusLabel,
  type ToolboxTalk,
  type ToolboxTalkStatus,
} from '@yge/shared';

const STATUSES: ToolboxTalkStatus[] = ['DRAFT', 'HELD', 'SUBMITTED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchTalks(filter: { status?: string; jobId?: string }): Promise<ToolboxTalk[]> {
  const url = new URL(`${apiBaseUrl()}/api/toolbox-talks`);
  if (filter.status) url.searchParams.set('status', filter.status);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { talks: ToolboxTalk[] }).talks;
}
async function fetchAll(): Promise<ToolboxTalk[]> {
  const res = await fetch(`${apiBaseUrl()}/api/toolbox-talks`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { talks: ToolboxTalk[] }).talks;
}

export default async function ToolboxTalksPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [talks, all] = await Promise.all([fetchTalks(searchParams), fetchAll()]);
  const rollup = computeToolboxTalkRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/toolbox-talks?${q}` : '/toolbox-talks';
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Home
        </Link>
        <Link
          href="/toolbox-talks/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New toolbox talk
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Toolbox Talks</h1>
      <p className="mt-2 text-gray-700">
        Cal/OSHA T8 §1509 requires a tailgate safety meeting at least every
        10 working days. Records are subject to inspection.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="Last held" value={rollup.lastHeldOn ?? '—'} />
        <Stat
          label="Working days since"
          value={rollup.daysSinceLast ?? '—'}
          variant={rollup.overdue ? 'bad' : 'ok'}
        />
        <Stat
          label="§1509 compliance"
          value={rollup.overdue ? 'OVERDUE' : 'Current'}
          variant={rollup.overdue ? 'bad' : 'ok'}
        />
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
        <Link
          href={buildHref({ status: undefined })}
          className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-yge-blue-500 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {toolboxTalkStatusLabel(s)}
          </Link>
        ))}
      </section>

      {talks.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No toolbox talks yet. Click <em>New toolbox talk</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Held</th>
                <th className="px-4 py-2">Topic</th>
                <th className="px-4 py-2">Leader</th>
                <th className="px-4 py-2 text-right">Attendees</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {talks.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-xs text-gray-700">{t.heldOn}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{t.topic}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{t.leaderName}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-700">
                    {signedAttendeeCount(t)} / {t.attendees.length}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-700">
                      {toolboxTalkStatusLabel(t.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`/toolbox-talks/${t.id}`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      Open
                    </Link>
                    {' · '}
                    <Link
                      href={`/toolbox-talks/${t.id}/sign-in`}
                      className="text-yge-blue-500 hover:underline"
                    >
                      Sign-in
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  variant = 'neutral',
}: {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const cls =
    variant === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : variant === 'warn'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
        : variant === 'bad'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
