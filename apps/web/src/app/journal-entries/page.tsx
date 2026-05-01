// /journal-entries — GL posting list.
//
// Plain English: general ledger postings. Every AR / AP / payroll /
// receipt eventually auto-posts a JE here. Hard rule: every entry
// must balance — sum of debits equals sum of credits to the cent.
// An out-of-balance row gets red treatment so it can't sneak by.

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
  computeJournalEntryRollup,
  isBalanced,
  journalEntrySourceLabel,
  journalEntryStatusLabel,
  totalDebitCents,
  type JournalEntry,
  type JournalEntryStatus,
} from '@yge/shared';

const STATUSES: JournalEntryStatus[] = ['DRAFT', 'POSTED', 'VOIDED'];

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEntries(filter: { status?: string }): Promise<JournalEntry[]> {
  try {
    const url = new URL(`${apiBaseUrl()}/api/journal-entries`);
    if (filter.status) url.searchParams.set('status', filter.status);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: JournalEntry[] }).entries;
  } catch {
    return [];
  }
}
async function fetchAll(): Promise<JournalEntry[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/journal-entries`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { entries: JournalEntry[] }).entries;
  } catch {
    return [];
  }
}

function statusTone(s: JournalEntryStatus): 'success' | 'warn' | 'muted' | 'neutral' {
  switch (s) {
    case 'POSTED': return 'success';
    case 'VOIDED': return 'muted';
    case 'DRAFT': return 'warn';
    default: return 'neutral';
  }
}

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const [entries, all] = await Promise.all([fetchEntries(searchParams), fetchAll()]);
  const rollup = computeJournalEntryRollup(all);

  function buildHref(overrides: Partial<{ status?: string }>): string {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...overrides };
    if (merged.status) params.set('status', merged.status);
    const q = params.toString();
    return q ? `/journal-entries?${q}` : '/journal-entries';
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Journal entries"
          subtitle="General ledger postings. Every AR / AP / payroll / receipt eventually auto-posts a JE here. Every entry must balance — debits = credits to the cent."
          actions={
            <LinkButton href="/trial-balance" variant="secondary" size="md">
              Trial balance
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total entries" value={rollup.total} />
          <Tile label="Posted" value={rollup.posted} />
          <Tile
            label="Draft"
            value={rollup.draft}
            tone={rollup.draft > 0 ? 'warn' : 'success'}
          />
          <Tile label="Posted $" value={<Money cents={rollup.postedDebitCents} />} />
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
              {journalEntryStatusLabel(s)}
            </Link>
          ))}
        </section>

        {entries.length === 0 ? (
          <EmptyState
            title="No journal entries yet"
            body="Phase 2 will auto-post these from AR / AP / payroll. The API accepts manual JEs at POST /api/journal-entries in the meantime."
          />
        ) : (
          <DataTable
            rows={entries}
            keyFn={(j) => j.id}
            columns={[
              { key: 'date', header: 'Date', cell: (j) => <span className="font-mono text-xs text-gray-700">{j.entryDate}</span> },
              {
                key: 'memo',
                header: 'Memo',
                cell: (j) => (
                  <div className="text-sm text-gray-900">
                    <div className="line-clamp-1">{j.memo}</div>
                    {j.sourceRef ? <div className="text-[10px] font-mono text-gray-500">{j.sourceRef}</div> : null}
                  </div>
                ),
              },
              { key: 'source', header: 'Source', cell: (j) => <span className="text-xs text-gray-700">{journalEntrySourceLabel(j.source)}</span> },
              { key: 'lines', header: 'Lines', numeric: true, cell: (j) => <span className="text-xs">{j.lines.length}</span> },
              { key: 'total', header: 'Total $', numeric: true, cell: (j) => <Money cents={totalDebitCents(j)} /> },
              {
                key: 'balanced',
                header: 'Balanced?',
                cell: (j) => isBalanced(j)
                  ? <span className="text-emerald-700">✓</span>
                  : <span className="text-xs font-bold text-red-700">OUT OF BALANCE</span>,
              },
              { key: 'status', header: 'Status', cell: (j) => <StatusPill label={journalEntryStatusLabel(j.status)} tone={statusTone(j.status)} /> },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
