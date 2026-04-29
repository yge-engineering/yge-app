// AR invoice line-kind mix.
//
// Plain English: every AR invoice line carries a kind (LABOR /
// EQUIPMENT / MATERIAL / SUBCONTRACT / OTHER). Roll the line
// items up across the invoice ledger to see what we actually
// bill — heavy-civil customers expect labor + equipment + sub
// shares roughly aligned with the bid breakdown.
//
// Per row: kind, lineCount, totalCents, distinctInvoices,
// distinctJobs, share.
//
// Sort by totalCents desc.
//
// Different from ar-invoice-source-mix (per source MANUAL /
// PROGRESS / etc.), monthly-billing (per month), and customer-
// month-matrix (customer × month).
//
// Pure derivation. No persisted records.

import type { ArInvoice, ArInvoiceLineKind } from './ar-invoice';

export interface ArInvoiceLineKindMixRow {
  kind: ArInvoiceLineKind;
  lineCount: number;
  totalCents: number;
  distinctInvoices: number;
  distinctJobs: number;
  share: number;
}

export interface ArInvoiceLineKindMixRollup {
  kindsConsidered: number;
  totalLines: number;
  totalCents: number;
}

export interface ArInvoiceLineKindMixInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildArInvoiceLineKindMix(
  inputs: ArInvoiceLineKindMixInputs,
): {
  rollup: ArInvoiceLineKindMixRollup;
  rows: ArInvoiceLineKindMixRow[];
} {
  type Acc = {
    lines: number;
    cents: number;
    invoices: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<ArInvoiceLineKind, Acc>();
  let portfolioCents = 0;
  let portfolioLines = 0;

  for (const inv of inputs.arInvoices) {
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    for (const line of inv.lineItems) {
      const acc = accs.get(line.kind) ?? {
        lines: 0,
        cents: 0,
        invoices: new Set<string>(),
        jobs: new Set<string>(),
      };
      acc.lines += 1;
      acc.cents += line.lineTotalCents;
      acc.invoices.add(inv.id);
      acc.jobs.add(inv.jobId);
      accs.set(line.kind, acc);
      portfolioCents += line.lineTotalCents;
      portfolioLines += 1;
    }
  }

  const rows: ArInvoiceLineKindMixRow[] = [];
  for (const [kind, acc] of accs.entries()) {
    const share = portfolioCents === 0
      ? 0
      : Math.round((acc.cents / portfolioCents) * 10_000) / 10_000;
    rows.push({
      kind,
      lineCount: acc.lines,
      totalCents: acc.cents,
      distinctInvoices: acc.invoices.size,
      distinctJobs: acc.jobs.size,
      share,
    });
  }

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      kindsConsidered: rows.length,
      totalLines: portfolioLines,
      totalCents: portfolioCents,
    },
    rows,
  };
}
