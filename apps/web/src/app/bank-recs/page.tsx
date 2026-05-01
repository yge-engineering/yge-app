// /bank-recs — bank reconciliation list.

import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
import {
  bankRecStatusLabel,
  computeBankRec,
  computeBankRecRollup,
  formatUSD,
  type BankRec,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchRecs(): Promise<BankRec[]> {
  const res = await fetch(`${apiBaseUrl()}/api/bank-recs`, { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { recs: BankRec[] }).recs;
}

export default async function BankRecsPage() {
  const recs = await fetchRecs();
  const rollup = computeBankRecRollup(recs);

  return (
    <AppShell>
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Dashboard
        </Link>
        <Link
          href="/bank-recs/new"
          className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
        >
          + New reconciliation
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-yge-blue-500">Bank Reconciliations</h1>
      <p className="mt-2 text-gray-700">
        One record per (bank account, statement period). Reconciles when{' '}
        statement balance − outstanding checks + outstanding deposits ={' '}
        GL balance + adjustments.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={rollup.total} />
        <Stat label="Reconciled" value={rollup.reconciled} variant="ok" />
        <Stat
          label="Draft"
          value={rollup.draft}
          variant={rollup.draft > 0 ? 'warn' : 'ok'}
        />
        <Stat label="Last reconciled" value={rollup.lastReconciledOn ?? '—'} />
      </section>

      {recs.length === 0 ? (
        <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No bank recs yet. Click <em>New reconciliation</em>.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Statement</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2 text-right">Statement $</th>
                <th className="px-4 py-2 text-right">GL $</th>
                <th className="px-4 py-2 text-right">Δ</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recs.map((r) => {
                const c = computeBankRec(r);
                return (
                  <tr key={r.id} className={c.inBalance ? '' : 'bg-yellow-50'}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {r.statementDate}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {r.bankAccountLabel}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(r.statementBalanceCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatUSD(r.glBalanceCents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-sm ${
                        c.inBalance ? 'text-gray-700' : 'font-bold text-yellow-800'
                      }`}
                    >
                      {formatUSD(c.imbalanceCents)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-semibold ${
                          r.status === 'RECONCILED'
                            ? 'bg-green-100 text-green-800'
                            : r.status === 'VOIDED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {bankRecStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <Link href={`/bank-recs/${r.id}`} className="text-yge-blue-500 hover:underline">
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
