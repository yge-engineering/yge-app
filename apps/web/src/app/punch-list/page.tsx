// /punch-list — closeout walkthrough item tracker.
//
// Plain English: punch items are the small fixes the owner spots
// during the final walkthrough — touch-up paint, missing screws, a
// crooked thermostat. Major + safety items must be cleared before
// final payment can be released, so they show in red here.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
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
  try {
    const url = new URL(`${apiBaseUrl()}/api/punch-items`);
    if (filter.status) url.searchParams.set('status', filter.status);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { items: PunchItem[] }).items;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<PunchItem[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/punch-items`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { items: PunchItem[] }).items;
  } catch {
    return [];
  }
}

function severityTone(s: PunchItem['severity']): 'danger' | 'warn' | 'neutral' {
  switch (s) {
    case 'SAFETY': return 'danger';
    case 'MAJOR': return 'warn';
    default: return 'neutral';
  }
}

function statusTone(s: PunchItemStatus): 'success' | 'danger' | 'muted' | 'neutral' {
  switch (s) {
    case 'CLOSED': return 'success';
    case 'DISPUTED': return 'danger';
    case 'WAIVED': return 'muted';
    default: return 'neutral';
  }
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
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Punch list"
          subtitle="Closeout walkthrough items. Major + safety items must be cleared before final payment can be released."
          actions={
            <LinkButton href="/punch-list/new" variant="primary" size="md">
              + New punch item
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile label="Open" value={rollup.open + rollup.inProgress} />
          <Tile
            label="Open safety"
            value={rollup.openSafety}
            tone={rollup.openSafety > 0 ? 'danger' : 'success'}
            warnText={rollup.openSafety > 0 ? 'Blocks final payment' : undefined}
          />
          <Tile
            label="Overdue"
            value={rollup.overdue}
            tone={rollup.overdue > 0 ? 'warn' : 'success'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">Status:</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`rounded px-2 py-1 text-xs ${searchParams.status === s ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              {punchItemStatusLabel(s)}
            </Link>
          ))}
        </section>

        {items.length === 0 ? (
          <EmptyState
            title="No punch items yet"
            body="During the closeout walkthrough, log every fix the owner spots. Safety + major items show in red so they can't get lost in the noise."
            actions={[{ href: '/punch-list/new', label: 'New punch item', primary: true }]}
          />
        ) : (
          <DataTable
            rows={items}
            keyFn={(it) => it.id}
            columns={[
              {
                key: 'severity',
                header: 'Severity',
                cell: (it) => <StatusPill label={punchItemSeverityLabel(it.severity)} tone={severityTone(it.severity)} />,
              },
              { key: 'location', header: 'Location', cell: (it) => <span className="text-xs text-gray-700">{it.location}</span> },
              {
                key: 'description',
                header: 'Description',
                cell: (it) => (
                  <Link href={`/punch-list/${it.id}`} className="line-clamp-2 text-sm font-medium text-blue-700 hover:underline">
                    {it.description}
                  </Link>
                ),
              },
              {
                key: 'responsible',
                header: 'Responsible',
                cell: (it) => it.responsibleParty ? <span className="text-xs text-gray-700">{it.responsibleParty}</span> : <span className="text-xs text-gray-400">—</span>,
              },
              {
                key: 'due',
                header: 'Due',
                cell: (it) => {
                  if (!it.dueOn) return <span className="font-mono text-xs text-gray-400">—</span>;
                  const overdue = isOverdue(it);
                  return <span className={`font-mono text-xs ${overdue ? 'font-semibold text-red-700' : 'text-gray-700'}`}>{it.dueOn}</span>;
                },
              },
              {
                key: 'status',
                header: 'Status',
                cell: (it) => <StatusPill label={punchItemStatusLabel(it.status)} tone={statusTone(it.status)} />,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
