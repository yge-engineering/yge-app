// Portfolio retention held by month-end.
//
// Plain English: month-end snapshot of retention. For each
// month-end, sum (invoice.retentionCents) across all AR
// invoices issued on/before that date, minus
// (RETENTION_RELEASE payments) received on/before that date.
// Drives the lender's "what's still being held back on YGE
// public-works contracts each month-end" view.
//
// Per row: month, heldCents, releasedCents, netHeldCents,
// invoiceCount.
//
// Sort: month asc.
//
// Different from retention (per-job snapshot),
// retention-projection (forward-looking).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

export interface PortfolioRetentionMonthlyRow {
  month: string;
  heldCents: number;
  releasedCents: number;
  netHeldCents: number;
  invoiceCount: number;
}

export interface PortfolioRetentionMonthlyRollup {
  monthsConsidered: number;
}

export interface PortfolioRetentionMonthlyInputs {
  arInvoices: ArInvoice[];
  arPayments: ArPayment[];
  fromMonth: string;
  toMonth: string;
}

function lastDayOfMonth(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  const y = Number(yStr ?? '0');
  const m = Number(mStr ?? '0');
  const d = new Date(Date.UTC(y, m, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function nextYyyymm(yyyymm: string): string {
  const [yStr, mStr] = yyyymm.split('-');
  let y = Number(yStr ?? '0');
  let m = Number(mStr ?? '0');
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function buildPortfolioRetentionMonthly(
  inputs: PortfolioRetentionMonthlyInputs,
): {
  rollup: PortfolioRetentionMonthlyRollup;
  rows: PortfolioRetentionMonthlyRow[];
} {
  const rows: PortfolioRetentionMonthlyRow[] = [];
  let cur = inputs.fromMonth;
  while (cur <= inputs.toMonth) {
    const asOf = lastDayOfMonth(cur);
    let heldCents = 0;
    let releasedCents = 0;
    let invoiceCount = 0;

    for (const inv of inputs.arInvoices) {
      if (inv.invoiceDate > asOf) continue;
      const ret = inv.retentionCents ?? 0;
      if (ret <= 0) continue;
      heldCents += ret;
      invoiceCount += 1;
    }
    for (const p of inputs.arPayments) {
      if (p.kind !== 'RETENTION_RELEASE') continue;
      if (p.receivedOn > asOf) continue;
      releasedCents += p.amountCents;
    }

    rows.push({
      month: cur,
      heldCents,
      releasedCents,
      netHeldCents: Math.max(0, heldCents - releasedCents),
      invoiceCount,
    });
    cur = nextYyyymm(cur);
  }

  return {
    rollup: { monthsConsidered: rows.length },
    rows,
  };
}
