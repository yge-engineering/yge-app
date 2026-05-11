// /risk-register — top business risks at a glance.
//
// Plain English: what's worth worrying about today, in one page?

import Link from 'next/link';

import {
  AppShell,
  Money,
  PageHeader,
} from '../../components';
import { requirePermission } from '../../lib/permissions';
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

interface RiskCard {
  key: string;
  title: string;
  severity: Severity;
  detail: string;
  href: string;
  cta: string;
}

function tone(s: Severity): string {
  if (s === 'RED') return 'border-red-300 bg-red-50';
  if (s === 'AMBER') return 'border-amber-300 bg-amber-50';
  return 'border-green-300 bg-green-50';
}

function badgeTone(s: Severity): string {
  if (s === 'RED') return 'bg-red-200 text-red-900';
  if (s === 'AMBER') return 'bg-amber-200 text-amber-900';
  return 'bg-green-200 text-green-900';
}

const SEVERITY_RANK: Record<Severity, number> = { RED: 0, AMBER: 1, GREEN: 2 };

export default async function RiskRegisterPage() {
  requirePermission('financials:view');

  const now = new Date();
  const year = now.getUTCFullYear();
  const start = `${year}-01-01`;
  const end = now.toISOString().slice(0, 10);

  const [
    arInvoices,
    apInvoices,
    apPayments,
    vendors,
    bankRecs,
  ] = await Promise.all([
    fetchJson<ArInvoice>('/api/ar-invoices', 'invoices'),
    fetchJson<ApInvoice>('/api/ap-invoices', 'invoices'),
    fetchJson<ApPayment>('/api/ap-payments', 'payments'),
    fetchJson<Vendor>('/api/vendors', 'vendors'),
    fetchJson<BankRec>('/api/bank-recs', 'recs'),
  ]);

  // Customer concentration (top-1 share)
  const cust = buildCustomerConcentration({ start, end, arInvoices });
  const top1 = cust.top1SharePct;
  const custCard: RiskCard = {
    key: 'customer-concentration',
    title: 'Customer concentration',
    severity: top1 >= 0.5 ? 'RED' : top1 >= 0.3 ? 'AMBER' : 'GREEN',
    detail:
      cust.rows.length === 0
        ? 'No AR billing this year — nothing to assess.'
        : `Top customer is ${(top1 * 100).toFixed(0)}% of YTD revenue (${cust.rows[0]?.customerName ?? '—'}). Top-5 = ${(cust.top5SharePct * 100).toFixed(0)}%.`,
    href: '/customer-concentration',
    cta: 'Open report →',
  };

  // Vendor concentration (top-5 share)
  const vSpend = buildVendorSpendReport({ start, end, apInvoices });
  const top5 = vSpend.top5SharePct;
  const vendorCard: RiskCard = {
    key: 'vendor-concentration',
    title: 'Vendor concentration',
    severity: top5 >= 0.8 ? 'RED' : top5 >= 0.6 ? 'AMBER' : 'GREEN',
    detail:
      vSpend.rows.length === 0
        ? 'No AP spend this year — nothing to assess.'
        : `Top-5 vendors take ${(top5 * 100).toFixed(0)}% of YTD spend. Largest: ${vSpend.rows[0]?.vendorName ?? '—'}.`,
    href: '/vendor-spend',
    cta: 'Open report →',
  };

  // 1099 readiness (missing-W9 blockers)
  const taxReport = buildVendor1099Report({
    year,
    vendors,
    payments: apPayments,
    asOf: now,
  });
  const taxCard: RiskCard = {
    key: 'tax-1099',
    title: '1099-NEC blockers',
    severity:
      taxReport.missingW9Count > 0
        ? 'RED'
        : taxReport.reportableCount > 0
          ? 'GREEN'
          : 'GREEN',
    detail:
      taxReport.missingW9Count > 0
        ? `${taxReport.missingW9Count} reportable vendor${taxReport.missingW9Count === 1 ? '' : 's'} over $600 missing a current W-9 — IRS blocker.`
        : taxReport.reportableCount === 0
          ? 'No reportable vendors yet this year.'
          : `${taxReport.reportableCount} reportable vendors, all W-9s current.`,
    href: '/1099-worksheet',
    cta: 'Worksheet →',
  };

  // Subcontractor COI aging
  const coi = buildVendorCoiAging({ vendors, asOf: end });
  const coiCard: RiskCard = {
    key: 'sub-coi',
    title: 'Subcontractor COIs',
    severity:
      coi.rollup.expired > 0
        ? 'RED'
        : coi.rollup.expiresSoon > 0 || coi.rollup.noCoi > 0
          ? 'AMBER'
          : 'GREEN',
    detail: coi.rollup.subsConsidered === 0
      ? 'No subcontractors on file.'
      : `${coi.rollup.expired} expired · ${coi.rollup.expiresSoon} expire within 30d · ${coi.rollup.noCoi} no COI.`,
    href: '/vendors',
    cta: 'Vendor list →',
  };

  // AR aging — 90+ day bucket
  const arAging = buildArAgingReport({ asOf: end, arInvoices });
  const dangerCents = arAging.bucketTotals['90+'] ?? 0;
  const arCard: RiskCard = {
    key: 'ar-90plus',
    title: 'AR over 90 days',
    severity: dangerCents > 0 ? 'RED' : arAging.totalOpenCents > 0 ? 'AMBER' : 'GREEN',
    detail:
      arAging.totalOpenCents === 0
        ? 'No open AR — fully collected.'
        : dangerCents > 0
          ? `${(dangerCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })} stuck 90+ days past due.`
          : `${(arAging.totalOpenCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })} open, none over 90 days.`,
    href: '/aging',
    cta: 'AR aging →',
  };

  // Cash position — last reconciled balance across all accounts
  const totalCashCents = (() => {
    const byAccount = new Map<string, BankRec>();
    for (const r of bankRecs) {
      const cur = byAccount.get(r.bankAccountLabel);
      if (!cur || r.statementDate > cur.statementDate) {
        byAccount.set(r.bankAccountLabel, r);
      }
    }
    let sum = 0;
    for (const r of byAccount.values()) sum += r.glBalanceCents;
    return sum;
  })();
  const cashCard: RiskCard = {
    key: 'cash-position',
    title: 'Cash position',
    severity:
      totalCashCents < 0
        ? 'RED'
        : totalCashCents < 50_000_00
          ? 'AMBER'
          : 'GREEN',
    detail:
      bankRecs.length === 0
        ? 'No bank recs filed yet.'
        : `Total reconciled cash: ${(totalCashCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })} across ${new Set(bankRecs.map((r) => r.bankAccountLabel)).size} account${new Set(bankRecs.map((r) => r.bankAccountLabel)).size === 1 ? '' : 's'}.`,
    href: '/cash-position',
    cta: 'Cash dashboard →',
  };

  const cards: RiskCard[] = [
    custCard,
    vendorCard,
    taxCard,
    coiCard,
    arCard,
    cashCard,
  ].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const red = cards.filter((c) => c.severity === 'RED').length;
  const amber = cards.filter((c) => c.severity === 'AMBER').length;
  const green = cards.filter((c) => c.severity === 'GREEN').length;

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl">
        <PageHeader
          title="Risk register"
          subtitle="Top business risks rolled up from across the app. Sorted with the loudest fires first."
        />

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-red-100 px-2 py-1 font-semibold text-red-800">
            {red} red
          </span>
          <span className="rounded bg-amber-100 px-2 py-1 font-semibold text-amber-800">
            {amber} amber
          </span>
          <span className="rounded bg-green-100 px-2 py-1 font-semibold text-green-800">
            {green} green
          </span>
        </div>

        <div className="space-y-3">
          {cards.map((c) => (
            <section
              key={c.key}
              className={`rounded-md border p-4 ${tone(c.severity)}`}
            >
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeTone(c.severity)}`}
                  >
                    {c.severity}
                  </span>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800">
                    {c.title}
                  </h2>
                </div>
                <Link
                  href={c.href}
                  className="shrink-0 text-xs font-semibold text-yge-blue-700 hover:underline"
                >
                  {c.cta}
                </Link>
              </header>
              <p className="mt-2 text-sm text-gray-800">{c.detail}</p>
            </section>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Severity is heuristic — red usually means &quot;handle this
          week,&quot; amber means &quot;handle this month,&quot; green
          means &quot;no action needed right now.&quot; Use{' '}
          <Link href="/dashboard" className="underline">
            the dashboard
          </Link>{' '}
          for the daily drill-down and this page for the monthly board-style read.
        </p>

        <p className="mt-2 text-[11px] text-gray-400">
          (Total cash {totalCashCents !== 0 ? <Money cents={totalCashCents} /> : '—'})
        </p>
      </main>
    </AppShell>
  );
}
