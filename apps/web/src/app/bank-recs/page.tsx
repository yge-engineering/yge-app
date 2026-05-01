// /bank-recs — bank reconciliation list.
//
// Plain English: one record per (bank account, statement period).
// Reconciles when statement balance − outstanding checks + outstanding
// deposits = GL balance + adjustments. Anything left over goes in
// the Δ column — that's the unmatched dollars to chase down.

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
  bankRecStatusLabel,
  computeBankRec,
  computeBankRecRollup,
  type BankRec,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchRecs(): Promise<BankRec[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bank-recs`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { recs: BankRec[] }).recs;
  } catch { return []; }
}

function statusTone(s: BankRec['status']): 'success' | 'warn' | 'muted' | 'neutral' {
  switch (s) {
    case 'RECONCILED': return 'success';
    case 'VOIDED': return 'muted';
    case 'DRAFT': return 'warn';
    default: return 'neutral';
  }
}

export default async function BankRecsPage() {
  const recs = await fetchRecs();
  const rollup = computeBankRecRollup(recs);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Bank reconciliations"
          subtitle="One record per (bank account, statement period). Reconciles when statement balance − outstanding checks + outstanding deposits = GL balance + adjustments."
          actions={
            <LinkButton href="/bank-recs/new" variant="primary" size="md">
              + New reconciliation
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label="Total" value={rollup.total} />
          <Tile label="Reconciled" value={rollup.reconciled} tone="success" />
          <Tile label="Draft" value={rollup.draft} tone={rollup.draft > 0 ? 'warn' : 'success'} />
          <Tile label="Last reconciled" value={rollup.lastReconciledOn ?? '—'} />
        </section>

        {recs.length === 0 ? (
          <EmptyState
            title="No bank recs yet"
            body="Pull each statement when it arrives and reconcile against the GL. The Δ column tells you how far off you are."
            actions={[{ href: '/bank-recs/new', label: 'New reconciliation', primary: true }]}
          />
        ) : (
          <DataTable
            rows={recs}
            keyFn={(r) => r.id}
            columns={[
              {
                key: 'statementDate',
                header: 'Statement',
                cell: (r) => (
                  <Link href={`/bank-recs/${r.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {r.statementDate}
                  </Link>
                ),
              },
              { key: 'account', header: 'Account', cell: (r) => <span className="text-sm text-gray-900">{r.bankAccountLabel}</span> },
              { key: 'statement', header: 'Statement $', numeric: true, cell: (r) => <Money cents={r.statementBalanceCents} /> },
              { key: 'gl', header: 'GL $', numeric: true, cell: (r) => <Money cents={r.glBalanceCents} /> },
              {
                key: 'delta',
                header: 'Δ',
                numeric: true,
                cell: (r) => {
                  const c = computeBankRec(r);
                  return (
                    <Money
                      cents={c.imbalanceCents}
                      className={c.inBalance ? '' : 'font-bold text-amber-800'}
                    />
                  );
                },
              },
              { key: 'status', header: 'Status', cell: (r) => <StatusPill label={bankRecStatusLabel(r.status)} tone={statusTone(r.status)} /> },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
