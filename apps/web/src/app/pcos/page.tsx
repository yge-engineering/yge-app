// /pcos — Potential Change Order log.
//
// Plain English: money + schedule already worked or about to be worked
// but not yet contracted for. PCOs become formal change orders once
// approved. Open exposure dollars are real dollars at risk until they
// flip to a CO.

import Link from 'next/link';

import {
  AppShell,
  DataTable,
  EmptyState,
  LinkButton,
  Money,
  PageHeader,
  StatusPill,
  Tile,
} from '../../components';
import {
  computePcoRollup,
  daysAwaitingResponse,
  isOpenExposure,
  pcoOriginLabel,
  pcoStatusLabel,
  type Pco,
  type PcoStatus,
} from '@yge/shared';

const STATUSES: PcoStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED_PENDING_CO',
  'REJECTED',
  'WITHDRAWN',
  'CONVERTED_TO_CO',
];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchPcos(filter: { status?: string; jobId?: string }): Promise<Pco[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/pcos`);
    if (filter.status) url.searchParams.set('status', filter.status);
    if (filter.jobId) url.searchParams.set('jobId', filter.jobId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { pcos: Pco[] }).pcos;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<Pco[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/pcos`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { pcos: Pco[] }).pcos;
  } catch {
    return [];
  }
}

function statusTone(p: Pco): 'success' | 'warn' | 'danger' | 'info' | 'neutral' {
  switch (p.status) {
    case 'CONVERTED_TO_CO':
      return 'success';
    case 'APPROVED_PENDING_CO':
      return 'warn';
    case 'REJECTED':
      return 'danger';
    default:
      return isOpenExposure(p) ? 'info' : 'neutral';
  }
}

export default async function PcoListPage({
  searchParams,
}: {
  searchParams: { status?: string; jobId?: string };
}) {
  const [pcos, all] = await Promise.all([fetchPcos(searchParams), fetchAll()]);
  const rollup = computePcoRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    if (merged.jobId) params.set('jobId', merged.jobId);
    const q = params.toString();
    return q ? `/pcos?${q}` : '/pcos';
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Potential change orders"
          subtitle="Money + schedule already worked or about to be worked but not yet contracted for. PCOs become formal change orders once approved."
          actions={
            <LinkButton href="/pcos/new" variant="primary" size="md">
              + New PCO
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile
            label="Open exposure ($)"
            value={<Money cents={rollup.openExposureCents} />}
            tone={rollup.openExposureCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Approved-pending-CO ($)"
            value={<Money cents={rollup.approvedPendingCoCents} />}
            tone={rollup.approvedPendingCoCents > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="Oldest awaiting reply"
            value={`${rollup.oldestAwaitingDays} days`}
            tone={rollup.oldestAwaitingDays > 30 ? 'danger' : rollup.oldestAwaitingDays > 14 ? 'warn' : 'success'}
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
              {pcoStatusLabel(s)}
            </Link>
          ))}
        </section>

        {pcos.length === 0 ? (
          <EmptyState
            title="No PCOs yet"
            body="Capture scope creep here so it doesn't disappear into the cost bucket. Once approved, convert each PCO into a formal CO."
            actions={[{ href: '/pcos/new', label: 'New PCO', primary: true }]}
          />
        ) : (
          <DataTable
            rows={pcos}
            keyFn={(p) => p.id}
            columns={[
              {
                key: 'pcoNumber',
                header: 'PCO #',
                cell: (p) => (
                  <Link href={`/pcos/${p.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {p.pcoNumber}
                  </Link>
                ),
              },
              {
                key: 'title',
                header: 'Title',
                cell: (p) => (
                  <div className="text-sm text-gray-900">
                    <div className="font-medium">{p.title}</div>
                    <div className="line-clamp-1 text-xs text-gray-500">{p.description}</div>
                  </div>
                ),
              },
              { key: 'origin', header: 'Origin', cell: (p) => <span className="text-xs text-gray-700">{pcoOriginLabel(p.origin)}</span> },
              { key: 'status', header: 'Status', cell: (p) => <StatusPill label={pcoStatusLabel(p.status)} tone={statusTone(p)} /> },
              { key: 'cost', header: 'Cost', numeric: true, cell: (p) => <Money cents={p.costImpactCents} /> },
              {
                key: 'days',
                header: 'Sched.',
                numeric: true,
                cell: (p) => (
                  <span className="font-mono text-xs text-gray-700">
                    {p.scheduleImpactDays > 0 ? `+${p.scheduleImpactDays}d` : p.scheduleImpactDays}
                  </span>
                ),
              },
              {
                key: 'awaiting',
                header: 'Awaiting',
                numeric: true,
                cell: (p) => {
                  const wait = daysAwaitingResponse(p);
                  if (wait <= 0) return <span className="font-mono text-xs text-gray-400">—</span>;
                  const flag = wait > 30;
                  return <span className={`font-mono text-xs ${flag ? 'font-semibold text-red-700' : 'text-gray-700'}`}>{wait}d</span>;
                },
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
