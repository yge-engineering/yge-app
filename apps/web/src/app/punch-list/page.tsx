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
import { getTranslator } from '../../lib/locale';
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('punch.title')}
          subtitle={t('punch.subtitle')}
          actions={
            <LinkButton href="/punch-list/new" variant="primary" size="md">
              {t('punch.newItem')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('punch.tile.total')} value={rollup.total} />
          <Tile label={t('punch.tile.open')} value={rollup.open + rollup.inProgress} />
          <Tile
            label={t('punch.tile.openSafety')}
            value={rollup.openSafety}
            tone={rollup.openSafety > 0 ? 'danger' : 'success'}
            warnText={rollup.openSafety > 0 ? t('punch.tile.openSafety.warn') : undefined}
          />
          <Tile
            label={t('punch.tile.overdue')}
            value={rollup.overdue}
            tone={rollup.overdue > 0 ? 'warn' : 'success'}
          />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">{t('punch.filter.status')}</span>
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded px-2 py-1 text-xs ${!searchParams.status ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t('punch.filter.all')}
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
            title={t('punch.empty.title')}
            body={t('punch.empty.body')}
            actions={[{ href: '/punch-list/new', label: t('punch.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={items}
            keyFn={(it) => it.id}
            columns={[
              {
                key: 'severity',
                header: t('punch.col.severity'),
                cell: (it) => <StatusPill label={punchItemSeverityLabel(it.severity)} tone={severityTone(it.severity)} />,
              },
              { key: 'location', header: t('punch.col.location'), cell: (it) => <span className="text-xs text-gray-700">{it.location}</span> },
              {
                key: 'description',
                header: t('punch.col.description'),
                cell: (it) => (
                  <Link href={`/punch-list/${it.id}`} className="line-clamp-2 text-sm font-medium text-blue-700 hover:underline">
                    {it.description}
                  </Link>
                ),
              },
              {
                key: 'responsible',
                header: t('punch.col.responsible'),
                cell: (it) => it.responsibleParty ? <span className="text-xs text-gray-700">{it.responsibleParty}</span> : <span className="text-xs text-gray-400">—</span>,
              },
              {
                key: 'due',
                header: t('punch.col.due'),
                cell: (it) => {
                  if (!it.dueOn) return <span className="font-mono text-xs text-gray-400">—</span>;
                  const overdue = isOverdue(it);
                  return <span className={`font-mono text-xs ${overdue ? 'font-semibold text-red-700' : 'text-gray-700'}`}>{it.dueOn}</span>;
                },
              },
              {
                key: 'status',
                header: t('punch.col.status'),
                cell: (it) => <StatusPill label={punchItemStatusLabel(it.status)} tone={statusTone(it.status)} />,
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
