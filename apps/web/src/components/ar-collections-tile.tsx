import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// AR collections dashboard tile — surfaces the count of urgent
// collection actions Brook should work this morning.
//
// Server component. Fetches AR invoices, computes ageDays + amount,
// runs the AR collection-sequence ranker, summarizes urgency ≥ 4
// rows as the "needs action today" count + lists the top 3.

import Link from 'next/link';
import {
  rankArCollections,
  formatUSD,
  type ArInvoice,
} from '@yge/shared';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchArInvoices(): Promise<ArInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ar-invoices?status=SENT`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return ((await res.json()) as { invoices: ArInvoice[] }).invoices;
  } catch {
    return [];
  }
}

function daysFromToday(iso: string): number {
  const dueMs = new Date(iso + 'T00:00:00Z').getTime();
  const todayMs = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((todayMs - dueMs) / (1000 * 60 * 60 * 24));
}

async function ArCollectionsTileInner() {
  const invoices = await fetchArInvoices();
  const eligible = invoices.filter(
    (i) => i.dueDate && i.totalCents > i.paidCents,
  );
  const ranked = rankArCollections(
    eligible.map((i) => ({
      amountCents: i.totalCents - i.paidCents,
      ageDays: daysFromToday(i.dueDate!),
    })),
  );

  // Match each ranked recommendation back to its invoice via index
  // (rankArCollections preserves input order through its sort key
  // when we feed plain pairs).
  const rows = ranked.map((row, idx) => ({
    rec: row.rec,
    invoice: eligible[idx]!,
  }));
  rows.sort(
    (a, b) =>
      b.rec.urgency - a.rec.urgency ||
      b.invoice.totalCents - a.invoice.totalCents,
  );

  const needAction = rows.filter((r) => r.rec.urgency >= 4).length;
  if (rows.length === 0) return null;

  const top3 = rows.slice(0, 3);
  const totalOutstanding = eligible.reduce(
    (s, i) => s + (i.totalCents - i.paidCents),
    0,
  );

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            AR collections
          </h2>
          <p className="text-xs text-gray-600">
            {rows.length} open invoice{rows.length === 1 ? '' : 's'} past due ·{' '}
            <span className="font-semibold">{formatUSD(totalOutstanding, { compact: true })}</span> outstanding
            {needAction > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                {needAction} need{needAction === 1 ? 's' : ''} action today
              </span>
            )}
          </p>
        </div>
        <Link
          href="/ar-collections"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Open collections →
        </Link>
      </header>
      <ul className="divide-y divide-gray-100">
        {top3.map(({ invoice, rec }) => (
          <li key={invoice.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <div className="flex-1">
              <Link
                href={`/ar-invoices/${invoice.id}`}
                className="font-medium text-gray-900 hover:text-yge-blue-700 hover:underline"
              >
                {invoice.customerName}
              </Link>
              <div className="text-xs text-gray-500">#{invoice.invoiceNumber}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums text-gray-900">
                {formatUSD(invoice.totalCents - invoice.paidCents)}
              </div>
              <div className="text-[11px] text-gray-500">{rec.action.replace(/_/g, ' ').toLowerCase()}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function ArCollectionsTile(): Promise<React.ReactElement | null> {
  try {
    return await ArCollectionsTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[ArCollectionsTile] render failed:', err);
    return null;
  }
}
