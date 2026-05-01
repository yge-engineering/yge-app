// /punch-list — closeout walkthrough item tracker.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  computePunchListRollup,
  isOverdue,
  punchItemSeverityLabel,
  punchItemStatusLabel,
  type PunchItem,
  type PunchItemStatus,
} from '@yge/shared';

const STATUSES: PunchItemStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'DISPUTED',
  'WAIVED',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchItems(filter: { status?: string; jobId?: string }): Promise<PunchItem[]> {
  const url = new URL(`${apiBaseUrl()}/api/punch-items`);
  if (filter.status) url.searchParams.set('status', filter.status);
  if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { items: PunchItem[] }).items;
}
async function fetchAll(): Promise<PunchItem[]> {
  const res = await fetch(`${apiBaseUrl()}/api/punch-items`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { items: PunchItem[] }).items;
}

export default async function PunchListPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [items, all] = await Promise.all([fetchItems(searchParams), fetchAll()]);
  const rollup = computePunchListRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/punch-list?${q}` : '/punch-list';
  }

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/punch-list/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New punch item
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Punch List</h1>
      <p className="mt-2 text-gray-700">
        Closeout walkthrough items. Major + safety items must be cleared
        before final payment can be released.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="Open" value={rollup.open + rollup.inProgress} />
        <Stat
          label="Open safety"
          value={rollup.openSafety}
          variant={rollup.openSafety > 0 ? 'bad' : 'ok'}
        />
        <Stat
          label="Overdue"
          value={rollup.overdue}
          variant={rollup.overdue > 0 ? 'warn' : 'ok'}
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
            {punchItemStatusLabel(s)}
          </Link>
        ))}
      </section>

      {items.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No punch items yet. Click <em>New punch item</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Responsible</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((it) => {
                const overdue = isOverdue(it);
                return (
                  <tr key={it.id} className={overdue ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                          it.severity === 'SAFETY'
                            ? 'bg-red-100 text-red-800'
                            : it.severity === 'MAJOR'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {punchItemSeverityLabel(it.severity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{it.location}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="line-clamp-2">{it.description}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {it.responsibleParty || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {it.dueOn ? (
                        <span className={overdue ? 'font-semibold text-red-700' : 'text-gray-700'}>
                          {it.dueOn}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                          it.status === 'CLOSED'
                            ? 'bg-green-100 text-green-800'
                            : it.status === 'DISPUTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {punchItemStatusLabel(it.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link
                        href={`/punch-list/${it.id}`}
                        className="text-yge-blue-500 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
    </AppShell>
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
