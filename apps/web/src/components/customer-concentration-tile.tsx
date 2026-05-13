import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard tile — customer revenue concentration for the current year.
//
// Plain English: who pays us, and are we too dependent on one
// customer? Red flag when top-1 share crosses 50%.

import Link from 'next/link';
import type { ArInvoice } from '@yge/shared';
import { buildCustomerConcentration } from '@yge/shared';

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

async function CustomerConcentrationTileInner() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const start = `${year}-01-01`;
  const end = now.toISOString().slice(0, 10);

  const arInvoices = await fetchJson<ArInvoice>('/api/ar-invoices', 'invoices');
  const report = buildCustomerConcentration({ start, end, arInvoices });

  if (report.rows.length === 0) {
    return null;
  }

  const top3 = report.rows.slice(0, 3);
  const top1Pct = Math.round(report.top1SharePct * 100);
  const tone =
    report.top1SharePct >= 0.5
      ? 'border-red-300 bg-red-50'
      : report.top1SharePct >= 0.3
        ? 'border-amber-300 bg-amber-50'
        : 'border-gray-200 bg-white';

  return (
    <section className={`mb-6 rounded-md border ${tone} p-4`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Customer concentration — {year} YTD
          </h2>
          <p className="text-xs text-gray-600">
            Top customer is {top1Pct}% of revenue.{' '}
            {report.top1SharePct >= 0.5
              ? '⚠︎ Heavy single-customer dependency — bonding-underwriter risk.'
              : report.top1SharePct >= 0.3
                ? 'Elevated — diversify pipeline.'
                : 'Healthy spread.'}
          </p>
        </div>
        <Link
          href="/customer-concentration"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Full report →
        </Link>
      </header>

      <ol className="mt-3 space-y-1 text-sm">
        {top3.map((r, i) => (
          <li
            key={`${r.customerName}-${i}`}
            className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1 last:border-0"
          >
            <div className="truncate text-gray-800">
              <span className="mr-2 font-mono text-xs text-gray-500">
                #{i + 1}
              </span>
              {r.customerName}
            </div>
            <div className="text-right">
              <span className="font-mono font-semibold text-yge-blue-900">
                <Money cents={r.billedCents} />
              </span>
              <span className="ml-2 text-xs text-gray-600">
                {(r.shareOfPeriod * 100).toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ol>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Total billed
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            <Money cents={report.totalBilledCents} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            Top-5 share
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            {(report.top5SharePct * 100).toFixed(0)}%
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">
            HHI
          </dt>
          <dd className="font-mono text-base font-semibold text-yge-blue-900">
            {Math.round(report.hhi).toLocaleString()}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// Resilient wrapper — if anything throws inside CustomerConcentrationTileInner (bad
// data shape, API timeout, builder bug), we render null instead of
// crashing the dashboard. Errors get logged server-side.
export async function CustomerConcentrationTile(): Promise<React.ReactElement | null> {
  try {
    return await CustomerConcentrationTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[CustomerConcentrationTile] render failed:', err);
    return null;
  }
}
