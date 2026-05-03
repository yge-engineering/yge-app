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
import { getTranslator } from '../../lib/locale';
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
  const t = getTranslator();

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title={t('bankRec.title')}
          subtitle={t('bankRec.subtitle')}
          actions={
            <LinkButton href="/bank-recs/new" variant="primary" size="md">
              {t('bankRec.newReconciliation')}
            </LinkButton>
          }
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-4">
          <Tile label={t('bankRec.tile.total')} value={rollup.total} />
          <Tile label={t('bankRec.tile.reconciled')} value={rollup.reconciled} tone="success" />
          <Tile label={t('bankRec.tile.draft')} value={rollup.draft} tone={rollup.draft > 0 ? 'warn' : 'success'} />
          <Tile label={t('bankRec.tile.lastReconciled')} value={rollup.lastReconciledOn ?? '—'} />
        </section>

        {recs.length === 0 ? (
          <EmptyState
            title={t('bankRec.empty.title')}
            body={t('bankRec.empty.body')}
            actions={[{ href: '/bank-recs/new', label: t('bankRec.empty.action'), primary: true }]}
          />
        ) : (
          <DataTable
            rows={recs}
            keyFn={(r) => r.id}
            columns={[
              {
                key: 'statementDate',
                header: t('bankRec.col.statement'),
                cell: (r) => (
                  <Link href={`/bank-recs/${r.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                    {r.statementDate}
                  </Link>
                ),
              },
              { key: 'account', header: t('bankRec.col.account'), cell: (r) => <span className="text-sm text-gray-900">{r.bankAccountLabel}</span> },
              { key: 'statement', header: t('bankRec.col.statementDollars'), numeric: true, cell: (r) => <Money cents={r.statementBalanceCents} /> },
              { key: 'gl', header: t('bankRec.col.glDollars'), numeric: true, cell: (r) => <Money cents={r.glBalanceCents} /> },
              {
                key: 'delta',
                header: t('bankRec.col.delta'),
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
              { key: 'status', header: t('bankRec.col.status'), cell: (r) => <StatusPill label={bankRecStatusLabel(r.status)} tone={statusTone(r.status)} /> },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
