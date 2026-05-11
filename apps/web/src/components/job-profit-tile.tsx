// Dashboard tile — job profitability watch.

import Link from 'next/link';
import {
  buildJobProfitRows,
  type ApInvoice,
  type ArInvoice,
  type ChangeOrder,
  type Expense,
  type Job,
  type MileageEntry,
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

export async function JobProfitTile() {
  const [jobs, arInvoices, apInvoices, changeOrders, expenses, mileage] =
    await Promise.all([
      fetchJson<Job>('/api/jobs', 'jobs'),
      fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
      fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
      fetchJson<ChangeOrder>('/api/change-orders', 'changeOrders'),
      fetchJson<Expense>('/api/expenses', 'expenses'),
      fetchJson<MileageEntry>('/api/mileage', 'entries'),
    ]);

  const rows = buildJobProfitRows({
    jobs,
    arInvoices,
    apInvoices,
    changeOrders,
    expenses,
    mileage,
  });

  // Active rows only — exclude archived + lost.
  const activeRows = rows.filter(
    (r) => r.status !== 'ARCHIVED' && r.status !== 'LOST',
  );
  if (activeRows.length === 0) return null;

  const negative = activeRows.filter((r) => r.grossProfitCents < 0);
  const sortedByMargin = [...activeRows].sort(
    (a, b) => a.grossMargin - b.grossMargin,
  );
  const worst = sortedByMargin[0];
  const avgMargin =
    activeRows.reduce((s, r) => s + r.grossMargin, 0) / activeRows.length;

  const tone =
    negative.length > 0
      ? 'border-red-300 bg-red-50'
      : avgMargin < 0.1
        ? 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-white';

  return (
    <section className={`mb-6 rounded-md border ${tone} p-4`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Job profitability — {activeRows.length} active
          </h2>
          <p className="text-xs text-gray-600">
            {negative.length > 0
              ? `⚠︎ ${negative.length} job${negative.length === 1 ? '' : 's'} running negative margin — review costs.`
              : avgMargin < 0.1
                ? 'Average margin below 10% — re-bid OPP markup on the next round.'
                : `Average margin ${(avgMargin * 100).toFixed(1)}%. Healthy.`}
          </p>
        </div>
        <Link
          href="/job-profit"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Full report →
        </Link>
      </header>
      {worst ? (
        <div className="mt-3 rounded border border-gray-100 bg-gray-50 p-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            Lowest margin
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`/jobs/${worst.jobId}`}
              className="font-semibold text-yge-blue-700 hover:underline"
            >
              {worst.projectName}
            </Link>
            <span
              className={`font-mono font-semibold ${worst.grossProfitCents < 0 ? 'text-red-700' : 'text-yge-blue-900'}`}
            >
              <Money cents={worst.grossProfitCents} />
              <span className="ml-2 text-xs">
                ({(worst.grossMargin * 100).toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
