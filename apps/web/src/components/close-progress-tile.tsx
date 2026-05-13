import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard tile — month-end close progress at a glance.

import Link from 'next/link';
import type {
  ApInvoice,
  ApPayment,
  ArInvoice,
  DailyReport,
  JournalEntry,
  SwpppInspection,
} from '@yge/shared';
import { buildCloseChecklist } from '@yge/shared';

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

function lastMonthLabel(): string {
  const now = new Date();
  // First day of current month; back one day → last day of prior.
  const lastMonthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  );
  return `${lastMonthEnd.getUTCFullYear()}-${String(
    lastMonthEnd.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
}

async function CloseProgressTileInner() {
  const [arInvoices, apInvoices, apPayments, dailyReports, journalEntries, swpppInspections] =
    await Promise.all([
      fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
      fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
      fetchJson<ApPayment>('/api/ap-payments', 'payments'),
      fetchJson<DailyReport>('/api/daily-reports', 'reports'),
      fetchJson<JournalEntry>('/api/journal-entries', 'entries'),
      fetchJson<SwpppInspection>('/api/swppp-inspections', 'inspections'),
    ]);

  const month = lastMonthLabel();
  const checklist = buildCloseChecklist({
    month,
    arInvoices,
    apInvoices,
    apPayments,
    dailyReports,
    journalEntries,
    swpppInspections,
  });

  const blockers = checklist.items.filter((i) => i.severity === 'BLOCKER');
  const passingBlockers = blockers.filter((i) => i.status === 'PASS');
  const blockerCount = blockers.length;
  const passed = passingBlockers.length;
  const allClear = checklist.readyToClose;

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Close progress — {month}
          </h2>
          <p className="text-xs text-gray-600">
            {allClear
              ? '✓ All month-end blockers passing — ready to close.'
              : `${passed} of ${blockerCount} blockers cleared.`}
          </p>
        </div>
        <Link
          href="/close-checklist"
          className={`text-xs ${
            allClear ? 'text-green-700' : 'text-amber-700'
          } hover:underline`}
        >
          Full checklist →
        </Link>
      </header>
      <div className="mt-3 h-2 rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full ${
            allClear
              ? 'bg-green-500'
              : passed === 0
                ? 'bg-red-500'
                : 'bg-amber-500'
          }`}
          style={{
            width: `${
              blockerCount > 0 ? (passed / blockerCount) * 100 : 100
            }%`,
          }}
        />
      </div>
      {!allClear ? (
        <ul className="mt-3 space-y-1 text-xs">
          {blockers
            .filter((i) => i.status !== 'PASS')
            .slice(0, 5)
            .map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <span
                  className={
                    i.status === 'FAIL'
                      ? 'text-red-700'
                      : 'text-amber-700'
                  }
                >
                  {i.status === 'FAIL' ? '✗' : '○'}
                </span>
                {i.href ? (
                  <Link href={i.href} className="text-yge-blue-700 hover:underline">
                    {i.label}
                  </Link>
                ) : (
                  <span>{i.label}</span>
                )}
                <span className="text-gray-500">— {i.detail}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}

// Resilient wrapper — return null instead of crashing the dashboard.
export async function CloseProgressTile(): Promise<React.ReactElement | null> {
  try {
    return await CloseProgressTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[CloseProgressTile] render failed:', err);
    return null;
  }
}

