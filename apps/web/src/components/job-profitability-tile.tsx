// Job profitability — revenue vs. direct cost, cleared only.
//
// Server component — fetches the AR/AP/expense rows for this job
// at request time. Only counts cleared rows so "money in the bank"
// is real. Pending (uncleared) buckets render below as a
// secondary line so Ryan can see what's in transit.

import {
  type ApPayment,
  type ArPayment,
  type Expense,
} from '@yge/shared';
import { Money } from './money';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchJson<T>(pathname: string, key: string): Promise<T[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}${pathname}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    const arr = body[key];
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

interface Tally {
  cleared: number;
  pending: number;
  clearedCount: number;
  pendingCount: number;
}

function tally<T extends { cleared?: boolean; amountCents: number }>(
  rows: T[],
): Tally {
  const out: Tally = { cleared: 0, pending: 0, clearedCount: 0, pendingCount: 0 };
  for (const r of rows) {
    if (r.cleared) {
      out.cleared += r.amountCents;
      out.clearedCount += 1;
    } else {
      out.pending += r.amountCents;
      out.pendingCount += 1;
    }
  }
  return out;
}

export async function JobProfitabilityTile({ jobId }: { jobId: string }) {
  const [ar, ap, expenses] = await Promise.all([
    fetchJson<ArPayment>('/api/ar-payments', 'payments'),
    fetchJson<ApPayment>('/api/ap-payments', 'payments'),
    fetchJson<Expense>('/api/expenses', 'expenses'),
  ]);

  const arForJob = ar.filter((r) => r.jobId === jobId);
  const apForJob = ap.filter(
    (p) => (p as unknown as { jobId?: string }).jobId === jobId,
  );
  const expForJob = expenses.filter((e) => e.jobId === jobId);

  const revenue = tally(arForJob);
  const apCost = tally(apForJob);
  const expCost = tally(expForJob);

  const directCost = {
    cleared: apCost.cleared + expCost.cleared,
    pending: apCost.pending + expCost.pending,
    clearedCount: apCost.clearedCount + expCost.clearedCount,
    pendingCount: apCost.pendingCount + expCost.pendingCount,
  };

  const marginCleared = revenue.cleared - directCost.cleared;
  const marginPct =
    revenue.cleared > 0 ? (marginCleared / revenue.cleared) * 100 : null;

  const totalRows =
    revenue.clearedCount +
    revenue.pendingCount +
    directCost.clearedCount +
    directCost.pendingCount;

  if (totalRows === 0) {
    return null;
  }

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Job profitability — cleared
          </h2>
          <p className="text-xs text-gray-600">
            Revenue minus direct cost, only counting payments + expenses
            the bank has confirmed cleared. Pending rows surface below as
            "in transit."
          </p>
        </div>
        {marginPct !== null ? (
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              marginCleared >= 0
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {marginPct >= 0 ? '+' : ''}
            {marginPct.toFixed(1)}% margin
          </span>
        ) : null}
      </header>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded border border-green-200 bg-green-50 p-3">
          <div className="text-xs uppercase tracking-wide text-green-800">
            Revenue (cleared AR)
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-green-900">
            <Money cents={revenue.cleared} />
          </div>
          <div className="text-[11px] text-green-800">
            {revenue.clearedCount} payment
            {revenue.clearedCount === 1 ? '' : 's'} cleared
            {revenue.pendingCount > 0
              ? ` · ${revenue.pendingCount} pending`
              : ''}
          </div>
        </div>
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <div className="text-xs uppercase tracking-wide text-red-800">
            Direct cost (cleared AP + expenses)
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-red-900">
            <Money cents={directCost.cleared} />
          </div>
          <div className="text-[11px] text-red-800">
            {apCost.clearedCount} AP, {expCost.clearedCount} expense
            {expCost.clearedCount === 1 ? '' : 's'}
            {directCost.pendingCount > 0
              ? ` · ${directCost.pendingCount} pending`
              : ''}
          </div>
        </div>
        <div
          className={`rounded border p-3 ${
            marginCleared >= 0
              ? 'border-yge-blue-200 bg-yge-blue-50'
              : 'border-red-300 bg-red-50'
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-gray-700">
            Margin (cleared)
          </div>
          <div
            className={`mt-1 font-mono text-lg font-bold ${
              marginCleared >= 0 ? 'text-yge-blue-900' : 'text-red-900'
            }`}
          >
            <Money cents={marginCleared} />
          </div>
          <div className="text-[11px] text-gray-700">
            Pending in transit:{' '}
            <Money cents={revenue.pending - directCost.pending} />
          </div>
        </div>
      </div>
    </section>
  );
}
