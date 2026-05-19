// /dispatches — daily crew dispatch list.
//
// Plain English: what's going out tomorrow. Each dispatch is one
// crew on one job for one day — foreman, meet time, scope, crew
// list, equipment list. Foremen print this and hand it out at the
// yard meeting.

import Link from 'next/link';

import { AppShell, PageHeader, EmptyState } from '../../components';
import { requirePermission } from '../../lib/permissions';
import type { Dispatch, DispatchStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchDispatches(): Promise<Dispatch[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/dispatches`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { dispatches?: Dispatch[] };
    return json.dispatches ?? [];
  } catch {
    return [];
  }
}

const STATUS_TONE: Record<DispatchStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  POSTED: 'bg-yge-blue-100 text-yge-blue-800',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default async function DispatchesPage() {
  requirePermission('field:view');
  const rows = await fetchDispatches();
  rows.sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1));

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-6">
        <PageHeader
          title="Dispatches"
          subtitle="One row per crew-day. What's going out tomorrow — foreman, meet time, scope, crew, equipment."
          actions={
            <Link
              href="/dispatches/new"
              className="rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700"
            >
              + New dispatch
            </Link>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            title="No dispatches yet"
            body="Create one for tomorrow's crews — pick a job, name the foreman, sketch the scope. You can flesh out crew + equipment later."
          />
        ) : (
          <div className="rounded border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Foreman</th>
                  <th className="px-3 py-2 text-left">Meet</th>
                  <th className="px-3 py-2 text-left">Crew</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 font-mono text-xs">{d.scheduledFor}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.jobId}</td>
                    <td className="px-3 py-2">{d.foremanName}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {d.meetTime ? `${d.meetTime}` : '—'}
                      {d.meetLocation ? ` · ${d.meetLocation}` : ''}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {d.crew.length} crew, {d.equipment.length} eq.
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[d.status]}`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
