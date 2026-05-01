// /punch-lists — closeout punch items across all jobs.
//
// Plain English: every open punch item, oldest first, with a red
// "overdue" badge for anything past its dueOn date. This is what
// you walk down with your foreman the week before substantial
// completion.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  punchItemSeverityLabel,
  punchItemStatusLabel,
  type PunchItem,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPunchItems(): Promise<PunchItem[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/punch-items`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body.items;
    return Array.isArray(arr) ? (arr as PunchItem[]) : [];
  } catch {
    return [];
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function severityClass(sev: string): string {
  switch (sev) {
    case 'SAFETY': return 'bg-red-100 text-red-800';
    case 'MAJOR':  return 'bg-amber-100 text-amber-800';
    case 'MINOR':  return 'bg-gray-100 text-gray-700';
    default:       return 'bg-gray-100 text-gray-700';
  }
}

const OPEN_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'DISPUTED']);

export default async function PunchListsPage() {
  const items = await fetchPunchItems();
  const today = todayIso();
  const open = items.filter((i) => OPEN_STATUSES.has(i.status));
  const closed = items.filter((i) => !OPEN_STATUSES.has(i.status));
  // Open: oldest identifiedOn first (most urgent).
  open.sort((a, b) => a.identifiedOn.localeCompare(b.identifiedOn));
  const overdueCount = open.filter((i) => i.dueOn && i.dueOn < today).length;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
            &larr; Dashboard
          </Link>
          <Link
            href="/punch-lists/new"
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            + New punch item
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Punch lists</h1>
          <p className="mt-1 text-sm text-gray-600">
            {open.length} open · {overdueCount > 0 ? <span className="font-semibold text-red-700">{overdueCount} overdue</span> : '0 overdue'} · {closed.length} closed
          </p>
        </header>

        {open.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
            No open punch items. Either everything's done or you haven't done a closeout walkthrough yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Identified</th>
                  <th className="px-4 py-2 font-semibold">Job</th>
                  <th className="px-4 py-2 font-semibold">Location</th>
                  <th className="px-4 py-2 font-semibold">Severity</th>
                  <th className="px-4 py-2 font-semibold">Description</th>
                  <th className="px-4 py-2 font-semibold">Due</th>
                  <th className="px-4 py-2 font-semibold">Responsible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {open.map((i) => {
                  const overdue = i.dueOn && i.dueOn < today;
                  return (
                    <tr key={i.id} className={overdue ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-700">{i.identifiedOn}</td>
                      <td className="px-4 py-2">
                        <Link href={`/jobs/${i.jobId}`} className="text-blue-700 hover:underline">
                          {i.jobId}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{i.location}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${severityClass(i.severity)}`}>
                          {punchItemSeverityLabel(i.severity)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{i.description}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {i.dueOn ? (
                          <span className={overdue ? 'font-semibold text-red-700' : ''}>{i.dueOn}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{i.responsibleParty ?? <span className="text-gray-400">unassigned</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {closed.length > 0 && (
          <details className="mt-6 rounded-md border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Closed items ({closed.length})
            </summary>
            <ul className="divide-y divide-gray-100 text-sm">
              {closed.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2 text-gray-600">
                  <span className="text-xs text-gray-400">{i.closedOn ?? i.identifiedOn}</span>
                  <span>{i.location}</span>
                  <span>·</span>
                  <span className="line-clamp-1">{i.description}</span>
                  <span className="ml-auto text-xs text-gray-500">{punchItemStatusLabel(i.status)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </AppShell>
  );
}
