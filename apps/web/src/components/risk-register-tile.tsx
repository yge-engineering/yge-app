import { isNextInternalError } from '../lib/next-control-flow';
import * as React from 'react';
// Dashboard tile — overall risk-register summary.
//
// Plain English: how many red / amber / green risks are there
// right now? One glance, then drill in via /risk-register.

import Link from 'next/link';
import {
  buildArAgingReport,
  buildCustomerConcentration,
  buildVendor1099Report,
  buildVendorCoiAging,
  buildVendorSpendReport,
  type ApInvoice,
  type ApPayment,
  type ArInvoice,
  type BankRec,
  type Vendor,
} from '@yge/shared';

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

type Severity = 'RED' | 'AMBER' | 'GREEN';

async function RiskRegisterTileInner() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const start = `${year}-01-01`;
  const end = now.toISOString().slice(0, 10);

  const [arInvoices, apInvoices, apPayments, vendors, bankRecs] =
    await Promise.all([
      fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
      fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
      fetchJson<ApPayment>('/api/ap-payments', 'payments'),
      fetchJson<Vendor>('/api/vendors', 'vendors'),
      fetchJson<BankRec>('/api/bank-recs', 'recs'),
    ]);

  const cust = buildCustomerConcentration({ start, end, arInvoices });
  const vSpend = buildVendorSpendReport({ start, end, apInvoices });
  const tax = buildVendor1099Report({
    year,
    vendors,
    payments: apPayments,
    asOf: now,
  });
  const coi = buildVendorCoiAging({ vendors, asOf: end });
  const arAging = buildArAgingReport({ asOf: end, arInvoices });
  const dangerAr = arAging.bucketTotals['90+'] ?? 0;

  // Cash position aggregate
  let totalCash = 0;
  {
    const byAccount = new Map<string, BankRec>();
    for (const r of bankRecs) {
      const cur = byAccount.get(r.bankAccountLabel);
      if (!cur || r.statementDate > cur.statementDate) {
        byAccount.set(r.bankAccountLabel, r);
      }
    }
    for (const r of byAccount.values()) totalCash += r.glBalanceCents;
  }

  const severities: Severity[] = [
    cust.top1SharePct >= 0.5
      ? 'RED'
      : cust.top1SharePct >= 0.3
        ? 'AMBER'
        : 'GREEN',
    vSpend.top5SharePct >= 0.8
      ? 'RED'
      : vSpend.top5SharePct >= 0.6
        ? 'AMBER'
        : 'GREEN',
    tax.missingW9Count > 0 ? 'RED' : 'GREEN',
    coi.rollup.expired > 0
      ? 'RED'
      : coi.rollup.expiresSoon > 0 || coi.rollup.noCoi > 0
        ? 'AMBER'
        : 'GREEN',
    dangerAr > 0 ? 'RED' : arAging.totalOpenCents > 0 ? 'AMBER' : 'GREEN',
    totalCash < 0
      ? 'RED'
      : totalCash < 50_000_00 && bankRecs.length > 0
        ? 'AMBER'
        : 'GREEN',
  ];

  const red = severities.filter((s) => s === 'RED').length;
  const amber = severities.filter((s) => s === 'AMBER').length;
  const green = severities.filter((s) => s === 'GREEN').length;

  const tileTone =
    red > 0
      ? 'border-red-300 bg-red-50'
      : amber > 0
        ? 'border-amber-300 bg-amber-50'
        : 'border-green-300 bg-green-50';

  return (
    <section className={`mb-6 rounded-md border ${tileTone} p-4`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
            Risk register
          </h2>
          <p className="text-xs text-gray-600">
            {red > 0
              ? `${red} red signal${red === 1 ? '' : 's'} — handle this week.`
              : amber > 0
                ? `${amber} amber signal${amber === 1 ? '' : 's'} — handle this month.`
                : 'All risks green. Nothing on fire today.'}
          </p>
        </div>
        <Link
          href="/risk-register"
          className="text-xs font-semibold text-yge-blue-700 hover:underline"
        >
          Full register →
        </Link>
      </header>
      <div className="mt-3 flex gap-2 text-xs">
        <span className="rounded bg-red-200 px-2 py-1 font-semibold text-red-900">
          {red} red
        </span>
        <span className="rounded bg-amber-200 px-2 py-1 font-semibold text-amber-900">
          {amber} amber
        </span>
        <span className="rounded bg-green-200 px-2 py-1 font-semibold text-green-900">
          {green} green
        </span>
      </div>
    </section>
  );
}

// Resilient wrapper — if anything throws inside RiskRegisterTileInner (bad
// data shape, API timeout, builder bug), we render null instead of
// crashing the dashboard. Errors get logged server-side.
export async function RiskRegisterTile(): Promise<React.ReactElement | null> {
  try {
    return await RiskRegisterTileInner();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.error('[RiskRegisterTile] render failed:', err);
    return null;
  }
}
