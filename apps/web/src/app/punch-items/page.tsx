// /punch-items — job closeout punch list.
//
// Plain English: the list of fixes a walkthrough identified before
// the agency releases final payment. Each item has a location,
// severity, who's on the hook, and a target date. Filter by status
// to triage what's still open vs what's closed.

import Link from 'next/link';

import { AppShell, PageHeader, EmptyState } from '../../components';
import { requirePermission } from '../../lib/permissions';
import type {
  PunchItem,
  PunchItemSeverity,
  PunchItemStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchItems(): Promise<PunchItem[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/punch-items`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { punchItems?: PunchItem[] };
    return json.punchItems ?? [];
  } catch {
    return [];
  }
}

const STATUS_TONE: Record<PunchItemStatus, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-green-100 text-green-700',
  DISPUTED: 'bg-yge-blue-100 text-yge-blue-800',
  WAIVED: 'bg-gray-100 text-gray-600',
};

const SEVERITY_TONE: Record<PunchItemSeverity, string> = {
  SAFETY: 'bg-red-100 text-red-800',
  MAJOR: 'bg-amber-100 text-amber-800',
  MINOR: 'bg-gray-100 text-gray-700',
};

export default async function PunchItemsPage() {
  requirePermission('field:view');
  const rows = await fetchItems();
  rows.sort((a, b) => {
    // OPEN first, then by identifiedOn desc
    const aOpen = a.status === 'OPEN' || a.status === 'IN_PROGRESS';
    const bOpen = b.status === 'OPEN' || b.status === 'IN_PROGRESS';
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return a.identifiedOn < b.identifiedOn ? 1 : -1;
  });

  const openCount = rows.filter((r) => r.status === 'OPEN').length;
  const inProgressCount = rows.filter((r) => r.status === 'IN_PROGRESS').length;
  const closedCount = rows.filter((r) => r.status === 'CLOSED').length;
  const safetyCount = rows.filter((r) => r.severity === 'SAFETY' && r.status !== 'CLOSED' && r.status !== 'WAIVED').length;

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Punch list"
          subtitle="Closeout walkthrough items — fix these before the agency releases final payment."
          actions={
            <Link
              href="/punch-items/new"
              className="rounded-md bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yge-blue-700"
            >
              + New punch item
            </Link>
          }
        />
        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Open" value={openCount} tone={openCount > 0 ? 'bad' : 'good'} />
          <Tile label="In progress" value={inProgressCount} tone={inProgressCount > 0 ? 'warn' : 'good'} />
          <Tile label="Closed" value={closedCount} tone="good" />
          <Tile label="Open safety" value={safetyCount} tone={safetyCount > 0 ? 'bad' : 'good'} />
        </section>

        {rows.length === 0 ? (
          <EmptyState
            title="No punch items yet"
            body="Add items as you find them during the closeout walkthrough."
          />
        ) : (
          <div className="rounded border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Identified</th>
                  <th className="px-3 py-2 text-left">Job</th>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Responsible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-mono text-xs">{r.identifiedOn}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.jobId}</td>
                    <td className="px-3 py-2 text-xs">{r.location}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.description.length > 80 ? r.description.slice(0, 80) + '…' : r.description}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_TONE[r.severity]}`}>
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[r.status]}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.dueOn ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.responsibleParty ?? '—'}</td>
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

function Tile({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
