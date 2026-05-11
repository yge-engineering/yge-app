// /cash-position — current cash across bank accounts.

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
import { type BankRec } from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchBankRecs(): Promise<BankRec[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/bank-recs`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { recs: BankRec[] }).recs;
  } catch {
    return [];
  }
}

interface AccountSnapshot {
  account: string;
  glBalanceCents: number;
  statementBalanceCents: number;
  lastReconciledAt: string | null;
  daysSinceReconciled: number | null;
  status: BankRec['status'];
  recId: string;
}

export default async function CashPositionPage() {
  requirePermission('financials:view');
  const recs = await fetchBankRecs();

  // For each account, pick the most recent rec by statementDate.
  const byAccount = new Map<string, BankRec>();
  for (const r of recs) {
    const cur = byAccount.get(r.bankAccountLabel);
    if (!cur || r.statementDate > cur.statementDate) {
      byAccount.set(r.bankAccountLabel, r);
    }
  }

  const now = new Date();
  const snapshots: AccountSnapshot[] = Array.from(byAccount.entries())
    .map(([account, rec]) => {
      const ms = Date.parse(rec.statementDate);
      const daysSinceReconciled = Number.isFinite(ms)
        ? Math.floor((now.getTime() - ms) / (24 * 60 * 60 * 1000))
        : null;
      return {
        account,
        glBalanceCents: rec.glBalanceCents,
        statementBalanceCents: rec.statementBalanceCents,
        lastReconciledAt: rec.statementDate,
        daysSinceReconciled,
        status: rec.status,
        recId: rec.id,
      };
    })
    .sort((a, b) => b.glBalanceCents - a.glBalanceCents);

  const totalGl = snapshots.reduce((s, x) => s + x.glBalanceCents, 0);
  const totalStatement = snapshots.reduce(
    (s, x) => s + x.statementBalanceCents,
    0,
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Cash position"
          subtitle="Latest reconciled balances per bank account. Numbers update when you save a new bank rec."
        />

        <section className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-yge-blue-300 bg-yge-blue-50 p-4">
            <div className="text-xs text-yge-blue-900">Total cash on hand (GL)</div>
            <div className="mt-1 font-mono text-2xl font-bold text-yge-blue-900">
              <Money cents={totalGl} />
            </div>
          </div>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-700">Per bank statements</div>
            <div className="mt-1 font-mono text-2xl font-bold text-gray-800">
              <Money cents={totalStatement} />
            </div>
            <div className="text-[11px] text-gray-500">
              Difference vs. GL ={' '}
              <Money cents={totalStatement - totalGl} />
            </div>
          </div>
        </section>

        {snapshots.length === 0 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            No bank recs found yet. Create one at{' '}
            <Link
              href="/bank-recs/new"
              className="font-semibold text-yge-blue-700 underline"
            >
              /bank-recs/new
            </Link>{' '}
            to seed this page.
          </p>
        ) : (
          <table className="w-full overflow-hidden rounded-md border border-gray-200 bg-white text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 text-right">GL balance</th>
                <th className="px-3 py-2 text-right">Statement</th>
                <th className="px-3 py-2 text-right">Δ</th>
                <th className="px-3 py-2">Last reconciled</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {snapshots.map((s) => {
                const delta = s.statementBalanceCents - s.glBalanceCents;
                return (
                  <tr key={s.account}>
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      <Link
                        href={`/bank-recs/${s.recId}`}
                        className="text-yge-blue-700 hover:underline"
                      >
                        {s.account}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <Money cents={s.glBalanceCents} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <Money cents={s.statementBalanceCents} />
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono ${
                        delta === 0
                          ? 'text-gray-700'
                          : Math.abs(delta) < 100
                            ? 'text-gray-700'
                            : 'text-red-700'
                      }`}
                    >
                      <Money cents={delta} />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="font-mono">{s.lastReconciledAt ?? '—'}</span>
                      {s.daysSinceReconciled != null ? (
                        <span
                          className={`ml-2 text-[11px] ${
                            s.daysSinceReconciled > 45
                              ? 'text-red-700'
                              : s.daysSinceReconciled > 30
                                ? 'text-amber-700'
                                : 'text-gray-500'
                          }`}
                        >
                          {s.daysSinceReconciled}d ago
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold uppercase ${
                          s.status === 'RECONCILED'
                            ? 'bg-green-100 text-green-800'
                            : s.status === 'VOIDED'
                              ? 'bg-gray-200 text-gray-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="mt-4 text-[11px] text-gray-500">
          The Δ column flags accounts where the bank statement and the GL
          balance disagree. Anything more than a few cents is a
          reconciliation issue — open the rec to chase it.
        </p>
      </main>
    </AppShell>
  );
}
