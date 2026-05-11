// Dashboard tile — vendor spend snapshot for the current calendar year.
//
// Plain English: which 3 vendors are getting most of our money this
// year, and are we over-concentrated (top-5 share >= 60%)? Red flag
// when concentration crosses 80%.

import Link from 'next/link';
import type { ApInvoice } from '@yge/shared';
import { buildVendorSpendReport } from '@yge/shared';

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

export async function VendorSpendTile() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const start = `${year}-01-01`;
  const end = now.toISOString().slice(0, 10);

  const apInvoices = await fetchJson<ApInvoice>('/api/ap-invoices', 'invoices');
  const report = buildVendorSpendReport({ start, end, apInvoices });

  if (report.rows.length === 0) {
    return null; // No spend yet this year; skip the tile entirely.
  }

  const top3 = report.rows.slice(0, 3);
  const concentrationPct = Math.round(report.top5SharePct * 100);
  const tone =
    report.top5SharePct >= 0.8
      ? 'border-red-300 bg-red-50'
      : report.top5SharePct >= 0.6
        ? 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-white';

  return (
    <section className={`mb-6 rounded-md border ${tone} p-4`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Vendor spend — {year} YTD
          </h2>
          <p className="text-xs text-gray-600">
            Top-5 vendors account for {concentrationPct}% of spend.{' '}
            {report.top5SharePct >= 0.8
              ? '⚠︎ Over-concentrated.'
              : report.top5SharePct >= 0.6
                ? 'Concentration is high — diversify before the next price hike.'
                : 'Spread is healthy.'}
          </p>
        </div>
        <Link
          href="/vendor-spend"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Full report →
        </Link>
      </header>

      <ol className="mt-3 space-y-1 text-sm">
        {top3.map((r, i) => (
          <li
            key={`${r.vendorName}-${i}`}
            className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0"
          >
            <div className="truncate text-gray-800">
              <span className="mr-2 font-mono text-xs text-gray-500">
                #{i + 1}
              </span>
              {r.vendorName}
            </div>
            <div className="text-right">
              <span className="font-mono font-semibold text-yge-blue-900">
                <Money cents={r.totalSpendCents} />
              </span>
              <span className="ml-2 text-xs text-gray-600">
                {(r.shareOfPeriod * 100).toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ol>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Total YTD
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            <Money cents={report.totalSpendCents} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Vendors used
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            {report.vendorCount}
          </dd>
        </div>
      </dl>
    </section>
  );
}
