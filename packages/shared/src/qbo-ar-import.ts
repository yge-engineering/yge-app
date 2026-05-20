// QuickBooks Online — open A/R import mapping.
//
// Source: QBO "A/R Aging Detail" or "Open Invoices" CSV export. Each row is
// an unpaid (or partially unpaid) customer invoice with an open balance.
// We turn each into an ArInvoice carrying the OPEN balance as the amount due
// (status SENT, paid 0), dated the original invoice date so the aging
// buckets are right. Because QBO invoices aren't tied to a YGE job, they all
// hang off a sentinel "migration" jobId the caller supplies.

import type { ArInvoiceCreate } from './ar-invoice';
import { parseCsvObjects } from './csv';
import { parseQboAmountToCents, parseQboDate } from './qbo-parse';

export const QBO_MIGRATION_JOB_ID = 'qbo-migration';

export interface QboArRow {
  customerName: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  openBalance?: string;
}

function pickKey(obj: Record<string, string>, candidates: readonly string[]): string | undefined {
  const lower = new Map<string, string>();
  for (const k of Object.keys(obj)) lower.set(k.toLowerCase(), k);
  for (const c of candidates) {
    const a = lower.get(c.toLowerCase());
    if (a !== undefined) return a;
  }
  return undefined;
}

const H = {
  customer: ['Customer', 'Name', 'Customer full name'],
  num: ['Num', 'No.', 'Invoice #', 'Number', 'Transaction #', 'Doc Num'],
  date: ['Date', 'Invoice Date', 'Transaction Date', 'Txn Date'],
  due: ['Due Date', 'Due date'],
  open: ['Open Balance', 'Open balance', 'Balance', 'Amount Due'],
} as const;

function val(row: Record<string, string>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const v = row[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export function arRowsFromCsv(csv: string): QboArRow[] {
  const objects = parseCsvObjects(csv);
  if (objects.length === 0) return [];
  const s = objects[0]!;
  const keys = {
    customer: pickKey(s, H.customer),
    num: pickKey(s, H.num),
    date: pickKey(s, H.date),
    due: pickKey(s, H.due),
    open: pickKey(s, H.open),
  };
  const out: QboArRow[] = [];
  for (const row of objects) {
    const customerName = val(row, keys.customer) ?? '';
    const openBalance = val(row, keys.open);
    // Drop subtotal / total lines (no customer, or no open balance).
    if (customerName.length === 0 && !openBalance) continue;
    out.push({
      customerName,
      invoiceNumber: val(row, keys.num),
      invoiceDate: val(row, keys.date),
      dueDate: val(row, keys.due),
      openBalance,
    });
  }
  return out;
}

export interface QboArImportInvoice extends ArInvoiceCreate {
  /** QBO customer name for the preview. */
  sourceCustomer: string;
}

export interface QboArImportResult {
  invoices: QboArImportInvoice[];
  warnings: string[];
  /** Sum of open balances across imported invoices, in cents. */
  totalOpenCents: number;
}

export interface QboArImportOptions {
  /** jobId the opening invoices hang off. Defaults to the migration sentinel. */
  jobId?: string;
}

export function buildQboArImport(
  rows: QboArRow[],
  options: QboArImportOptions = {},
): QboArImportResult {
  const jobId = options.jobId && options.jobId.length > 0 ? options.jobId : QBO_MIGRATION_JOB_ID;
  const invoices: QboArImportInvoice[] = [];
  const warnings: string[] = [];
  let seq = 0;
  let totalOpenCents = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const customerName = row.customerName.trim();
    if (customerName.length === 0) {
      warnings.push('Skipped a row with no customer name.');
      continue;
    }
    const openCents = parseQboAmountToCents(row.openBalance);
    if (openCents === null) {
      warnings.push(`"${customerName}" invoice ${row.invoiceNumber ?? '(no #)'}: open balance is blank — skipped.`);
      continue;
    }
    if (openCents <= 0) {
      warnings.push(`"${customerName}" invoice ${row.invoiceNumber ?? '(no #)'}: open balance is ${openCents} — skipped (nothing to collect).`);
      continue;
    }
    const invoiceDate = parseQboDate(row.invoiceDate);
    if (!invoiceDate) {
      warnings.push(`"${customerName}" invoice ${row.invoiceNumber ?? '(no #)'}: date "${row.invoiceDate ?? ''}" not understood — skipped.`);
      continue;
    }

    seq += 1;
    const invoiceNumber = row.invoiceNumber ?? `QBO-AR-${String(seq).padStart(4, '0')}`;
    const dedupKey = `${customerName.toLowerCase()}::${invoiceNumber.toLowerCase()}`;
    if (seen.has(dedupKey)) {
      warnings.push(`Duplicate invoice ${invoiceNumber} for "${customerName}" — kept the first.`);
      continue;
    }
    seen.add(dedupKey);

    const dueDate = parseQboDate(row.dueDate);

    const invoice: QboArImportInvoice = {
      sourceCustomer: customerName,
      jobId,
      invoiceNumber,
      customerName,
      invoiceDate,
      subtotalCents: openCents,
      totalCents: openCents,
      paidCents: 0,
      status: 'SENT',
      source: 'MANUAL',
      notes: 'Imported from QuickBooks open A/R (opening balance).',
    };
    if (dueDate) invoice.dueDate = dueDate;

    invoices.push(invoice);
    totalOpenCents += openCents;
  }

  return { invoices, warnings, totalOpenCents };
}
