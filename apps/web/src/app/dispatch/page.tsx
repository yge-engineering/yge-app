// /dispatch — daily dispatch board.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  computeDispatchRollup,
  detectDoubleBookings,
  dispatchStatusLabel,
  type Dispatch,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchDispatches(filter: {
  scheduledFor?: string;
  jobId?: string;
}): Promise<Dispatch[]> {
  const url = new URL(`${apiBaseUrl()}/api/dispatches`);
  if (filter.scheduledFor) url.searchParams.set('scheduledFor', filter.scheduledFor);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { dispatches: Dispatch[] }).dispatches;
}
async function fetchAll(): Promise<Dispatch[]> {
  const res = await fetch(`${apiBaseUrl()}/api/dispatches`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { dispatches: Dispatch[] }).dispatches;
}

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: { scheduledFor?: string; jobId?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const filter = {
    scheduledFor: searchParams.scheduledFor ?? today,
    jobId: searchParams.jobId,
  };
  const [dispatches, all] = await Promise.all([fetchDispatches(filter), fetchAll()]);
  const rollup = computeDispatchRollup(all, today);
  const doubleBookings = detectDoubleBookings(all);
  const todaysDoubleBookings = doubleBookings.filter(
    (db) => db.scheduledFor === filter.scheduledFor,
  );

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${publicApiBaseUrl()}/api/dispatches?format=csv&scheduledFor=${encodeURIComponent(filter.scheduledFor)}${filter.jobId ? '&jobId=' + encodeURIComponent(filter.jobId) : ''}`}
            className="rounded border border-yge-blue-500 px-3 py-1 text-sm font-medium text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Download CSV
          </a>
          <Link
            href="/dispatch/new"
            className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
          >
            + New dispatch
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Dispatch Board</h1>
      <p className="mt-2 text-gray-700">
        Today's crew + equipment assignments. Print one yard handout per job.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Today's jobs" value={rollup.todayCount} />
        <Stat label="Crew on today" value={rollup.todayCrewHeadcount} />
        <Stat label="Equipment today" value={rollup.todayEquipmentCount} />
        <Stat
          label="Double-bookings"
          value={rollup.doubleBookings}
          variant={rollup.doubleBookings > 0 ? 'bad' : 'ok'}
        />
      </section>

      {todaysDoubleBookings.length > 0 && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>Double-booked on {filter.scheduledFor}:</strong>
          <ul className="mt-1 list-disc pl-5">
            {todaysDoubleBookings.map((db, i) => (
              <li key={i}>
                {db.kind === 'CREW' ? 'Crew member' : 'Equipment'}{' '}
                <strong>{db.name}</strong> assigned to {db.dispatchIds.length} dispatches
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500">Day:</span>
        <DayLink label="Today" date={today} active={filter.scheduledFor === today} />
        <DayLink
          label="Tomorrow"
          date={addDays(today, 1)}
          active={filter.scheduledFor === addDays(today, 1)}
        />
        <DayLink
          label="Yesterday"
          date={addDays(today, -1)}
          active={filter.scheduledFor === addDays(today, -1)}
        />
        <form action="/dispatch" className="ml-2 flex items-center gap-2">
          <input
            type="date"
            name="scheduledFor"
            defaultValue={filter.scheduledFor}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <button
            type="submit"
            className="rounded border border-yge-blue-500 px-2 py-1 text-xs text-yge-blue-500 hover:bg-yge-blue-50"
          >
            Go
          </button>
        </form>
      </section>

      {dispatches.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No dispatches scheduled for {filter.scheduledFor}. Click{' '}
          <em>New dispatch</em> to assign a crew.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {dispatches.map((d) => (
            <DispatchCard key={d.id} d={d} />
          ))}
        </div>
      )}
    </main>
    </AppShell>
  );
}

function DispatchCard({ d }: { d: Dispatch }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {d.scheduledFor}
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{d.jobId}</h2>
          <p className="text-sm text-gray-700">
            Foreman: {d.foremanName}
            {d.foremanPhone ? ` · ${d.foremanPhone}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
              d.status === 'POSTED'
                ? 'bg-green-100 text-green-800'
                : d.status === 'COMPLETED'
                  ? 'bg-gray-100 text-gray-700'
                  : d.status === 'CANCELLED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {dispatchStatusLabel(d.status)}
          </span>
          <Link
            href={`/dispatch/${d.id}/handout`}
            className="text-xs text-yge-blue-500 hover:underline"
          >
            Print handout
          </Link>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="font-semibold uppercase text-gray-500">Meet</div>
          <div>{d.meetTime ?? '—'}</div>
          <div className="text-gray-600">{d.meetLocation ?? '—'}</div>
        </div>
        <div>
          <div className="font-semibold uppercase text-gray-500">Headcount</div>
          <div>
            {d.crew.length} crew · {d.equipment.length} equip
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xs font-semibold uppercase text-gray-500">Scope</div>
        <div className="line-clamp-3 text-sm text-gray-800">{d.scopeOfWork}</div>
      </div>
      {d.crew.length > 0 && (
        <div className="mt-2 text-xs text-gray-700">
          <span className="font-semibold">Crew:</span>{' '}
          {d.crew.map((c) => c.name).join(', ')}
        </div>
      )}
      {d.equipment.length > 0 && (
        <div className="mt-1 text-xs text-gray-700">
          <span className="font-semibold">Equipment:</span>{' '}
          {d.equipment.map((e) => e.name).join(', ')}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-3 text-sm">
        <Link href={`/dispatch/${d.id}`} className="text-yge-blue-500 hover:underline">
          Edit
        </Link>
      </div>
    </article>
  );
}

function DayLink({
  label,
  date,
  active,
}: {
  label: string;
  date: string;
  active: boolean;
}) {
  return (
    <Link
      href={`/dispatch?scheduledFor=${date}`}
      className={`rounded px-2 py-1 text-xs ${
        active
          ? 'bg-yge-blue-500 text-white'
          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label} ({date})
    </Link>
  );
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
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
