import * as React from 'react';
// AR aging snapshot tile — at-a-glance "what's overdue."
//
// Server component — fetches AR invoices, runs buildArAgingReport,
// renders a 4-column bucket strip + a CTA link to /aging.

import Link from 'next/link';
import {
  buildArAgingReport,
  AGING_BUCKETS,
  type AgingBucket,
  type ArInvoice,
} from '@yge/shared';
import { Money } from './money';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchArInvoices(): Promise<ArInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch {
    return [];
  }
}

const BUCKET_LABEL: Record<AgingBucket, string> = {
  '0-30': '0-30 days',
  '31-60': '31-60 days',
  '61-90': '61-90 days',
  '90+': '90+ overdue',
};

const BUCKET_TONE: Record<AgingBucket, string> = {
  '0-30': 'border-gray-200 bg-white text-gray-900',
  '31-60': 'border-amber-200 bg-amber-50 text-amber-900',
  '61-90': 'border-orange-200 bg-orange-50 text-orange-900',
  '90+': 'border-red-300 bg-red-50 text-red-900',
};

async function ArAgingTileInner() {
  const invoices = await fetchArInvoices();
  const asOf = new Date().toISOString().slice(0, 10);
  const report = buildArAgingReport({ asOf, arInvoices: invoices });

  if (report.totalOpenCents === 0) {
    return null;
  }

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            AR aging — open invoices as of {asOf}
          </h2>
          <p className="text-xs text-gray-600">
            {report.rows.length} open invoice{report.rows.length === 1 ? '' : 's'}
            {' · total '}
            <Money cents={report.totalOpenCents} />
            {report.hasDangerBucket ? (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                ⚠ Has 90+ overdue
              </span>
            ) : null}
          </p>
        </div>
        <Link
          href="/aging"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Open aging report →
        </Link>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AGING_BUCKETS.map((b) => {
          const cents = report.bucketTotals[b];
          return (
            <div
              key={b}
              className={`rounded border ${BUCKET_TONE[b]} p-2 text-center`}
            >
              <div className="text-[11px] uppercase tracking-wide opacity-75">
                {BUCKET_LABEL[b]}
              </div>
              <div className="mt-1 font-mono text-lg font-bold">
                <Money cents={cents} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Resilient wrapper — return null instead of crashing the dashboard.
export async function ArAgingTile(): Promise<React.ReactElement | null> {
  try {
    return await ArAgingTileInner();
  } catch (err) {
    console.error('[ArAgingTile] render failed:', err);
    return null;
  }
}

