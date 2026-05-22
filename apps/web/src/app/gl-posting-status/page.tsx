// /gl-posting-status — which AR/AP invoices still need a journal entry.
//
// Pairs with the Post-to-GL buttons on the AR/AP detail pages. Lists every
// AR and AP invoice with its GL state — UNPOSTED (no entry yet), DRAFT (a
// draft entry awaiting review/post), or POSTED — so the office can clear the
// backlog. Unposted invoices float to the top.

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
import { requirePermission } from '../../lib/permissions';
import {
  buildGlPostingStatus,
  type GlPostingInvoiceInput,
  type GlPostingJournalEntryInput,
  type GlPostingState,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(apiBaseUrl() + pathname, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

const STATE_TONE: Record<GlPostingState, 'danger' | 'warn' | 'success'> = {
  UNPOSTED: 'danger',
  DRAFT: 'warn',
  POSTED: 'success',
};

const STATE_LABEL: Record<GlPostingState, string> = {
  UNPOSTED: 'Unposted',
  DRAFT: 'Draft',
  POSTED: 'Posted',
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'UNPOSTED', label: 'Unposted' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'POSTED', label: 'Posted' },
];

export default async function GlPostingStatusPage({
  searchParams,
}: {
  searchParams: { state?: string };
}) {
  requirePermission('financials:view');

  const [arBody, apBody, jeBody] = await Promise.all([
    fetchJson<{ invoices: GlPostingInvoiceInput[] }>('/api/ar-invoices', { invoices: [] }),
    fetchJson<{ invoices: GlPostingInvoiceInput[] }>('/api/ap-invoices', { invoices: [] }),
    fetchJson<{ entries: GlPostingJournalEntryInput[] }>('/api/journal-entries', { entries: [] }),
  ]);

  const summary = buildGlPostingStatus(
    arBody.invoices ?? [],
    apBody.invoices ?? [],
    jeBody.entries ?? [],
  );

  const active =
    searchParams.state && ['UNPOSTED', 'DRAFT', 'POSTED'].includes(searchParams.state)
      ? (searchParams.state as GlPostingState)
      : null;
  const visible = active ? summary.rows.filter((r) => r.glState === active) : summary.rows;
  // DataTable infers its row type from `rows` and needs an `id`; derive a
  // stable one so inference resolves to the full row shape.
  const tableRows = visible.map((r) => ({ ...r, id: `${r.kind}-${r.invoiceId}` }));

  function buildHref(state: string): string {
    return state === 'all' ? '/gl-posting-status' : `/gl-posting-status?state=${state}`;
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="GL posting status"
          subtitle="Which AR and AP invoices still need a journal entry. Unposted invoices float to the top — open the invoice and use Post to GL to clear them."
          actions={
            <LinkButton href="/journal-entries" variant="secondary" size="md">
              Journal entries
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile
            label="AR unposted"
            value={summary.arUnposted}
            tone={summary.arUnposted > 0 ? 'warn' : 'success'}
          />
          <Tile
            label="AP unposted"
            value={summary.apUnposted}
            tone={summary.apUnposted > 0 ? 'warn' : 'success'}
          />
          <Tile label="Drafts awaiting post" value={summary.arDraft + summary.apDraft} />
          <Tile label="Unposted dollars" value={<Money cents={summary.unpostedTotalCents} />} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white p-3">
          <span className="text-xs uppercase tracking-wide text-gray-500">State</span>
          {FILTERS.map((f) => {
            const isActive = f.key === 'all' ? !active : active === f.key;
            return (
              <Link
                key={f.key}
                href={buildHref(f.key)}
                className={`rounded px-2 py-1 text-xs ${isActive ? 'bg-blue-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                {f.label}
              </Link>
            );
          })}
        </section>

        {tableRows.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            body="No invoices match this filter. AR or AP invoices without a journal entry show up here."
          />
        ) : (
          <DataTable
            rows={tableRows}
            columns={[
              {
                key: 'kind',
                header: 'Type',
                cell: (r) => (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      r.kind === 'AR' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {r.kind}
                  </span>
                ),
              },
              {
                key: 'invoice',
                header: 'Invoice',
                cell: (r) => {
                  const href =
                    r.kind === 'AR' ? `/ar-invoices/${r.invoiceId}` : `/ap-invoices/${r.invoiceId}`;
                  return (
                    <Link href={href} className="font-mono text-sm text-blue-700 hover:underline">
                      {r.invoiceNumber}
                    </Link>
                  );
                },
              },
              {
                key: 'party',
                header: 'Customer / Vendor',
                cell: (r) => <span className="text-sm text-gray-900">{r.party}</span>,
              },
              {
                key: 'total',
                header: 'Amount',
                numeric: true,
                cell: (r) => <Money cents={r.totalCents} />,
              },
              {
                key: 'invStatus',
                header: 'Invoice',
                cell: (r) => <span className="text-xs text-gray-600">{r.invoiceStatus}</span>,
              },
              {
                key: 'glState',
                header: 'GL state',
                cell: (r) =>
                  r.journalEntryId ? (
                    <Link href={`/journal-entries/${r.journalEntryId}`} className="hover:underline">
                      <StatusPill label={STATE_LABEL[r.glState]} tone={STATE_TONE[r.glState]} />
                    </Link>
                  ) : (
                    <StatusPill label={STATE_LABEL[r.glState]} tone={STATE_TONE[r.glState]} />
                  ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
