// QuickBooks Online — open A/P import mapping.
//
// Source: QBO "A/P Aging Detail" or "Unpaid Bills" CSV export. Each row is an
// unpaid vendor bill with an open balance. We turn each into an ApInvoice
// carrying the OPEN balance as the amount owed (status APPROVED, paid 0),
// dated the original bill date so the aging buckets are right. AP invoices
// allow a null job, so opening payables carry no job linkage.

import type { ApInvoiceCreate } from './ap-invoice';
import { parseCsvObjects } from './csv';
import { parseQboAmountToCents, parseQboDate } from './qbo-parse';

export interface QboApRow {
  vendorName: string;
  invoiceNumber?: string;
  billDate?: string;
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
  vendor: ['Vendor', 'Name', 'Payee', 'Vendor full name'],
  num: ['Num', 'Bill #', 'Ref No.', 'Ref Number', 'No.', 'Number', 'Doc Num'],
  date: ['Date', 'Bill Date', 'Transaction Date', 'Txn Date'],
  due: ['Due Date', 'Due date'],
  open: ['Open Balance', 'Open balance', 'Balance', 'Amount Due'],
} as const;

function val(row: Record<string, string>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const v = row[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export function apRowsFromCsv(csv: string): QboApRow[] {
  const objects = parseCsvObjects(csv);
  if (objects.length === 0) return [];
  const s = objects[0]!;
  const keys = {
    vendor: pickKey(s, H.vendor),
    num: pickKey(s, H.num),
    date: pickKey(s, H.date),
    due: pickKey(s, H.due),
    open: pickKey(s, H.open),
  };
  const out: QboApRow[] = [];
  for (const row of objects) {
    const vendorName = val(row, keys.vendor) ?? '';
    const openBalance = val(row, keys.open);
    if (vendorName.length === 0 && !openBalance) continue;
    out.push({
      vendorName,
      invoiceNumber: val(row, keys.num),
      billDate: val(row, keys.date),
      dueDate: val(row, keys.due),
      openBalance,
    });
  }
  return out;
}

export interface QboApImportBill extends ApInvoiceCreate {
  /** QBO vendor name for the preview. */
  sourceVendor: string;
}

export interface QboApImportResult {
  bills: QboApImportBill[];
  warnings: string[];
  /** Sum of open balances across imported bills, in cents. */
  totalOpenCents: number;
}

export function buildQboApImport(rows: QboApRow[]): QboApImportResult {
  const bills: QboApImportBill[] = [];
  const warnings: string[] = [];
  let totalOpenCents = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const vendorName = row.vendorName.trim();
    if (vendorName.length === 0) {
      warnings.push('Skipped a row with no vendor name.');
      continue;
    }
    const openCents = parseQboAmountToCents(row.openBalance);
    if (openCents === null) {
      warnings.push(`"${vendorName}" bill ${row.invoiceNumber ?? '(no #)'}: open balance is blank — skipped.`);
      continue;
    }
    if (openCents <= 0) {
      warnings.push(`"${vendorName}" bill ${row.invoiceNumber ?? '(no #)'}: open balance is ${openCents} — skipped (nothing to pay).`);
      continue;
    }
    const invoiceDate = parseQboDate(row.billDate);
    if (!invoiceDate) {
      warnings.push(`"${vendorName}" bill ${row.invoiceNumber ?? '(no #)'}: date "${row.billDate ?? ''}" not understood — skipped.`);
      continue;
    }

    const invoiceNumber = row.invoiceNumber;
    const dedupKey = `${vendorName.toLowerCase()}::${(invoiceNumber ?? `${invoiceDate}|${openCents}`).toLowerCase()}`;
    if (seen.has(dedupKey)) {
      warnings.push(`Duplicate bill ${invoiceNumber ?? '(no #)'} for "${vendorName}" — kept the first.`);
      continue;
    }
    seen.add(dedupKey);

    const dueDate = parseQboDate(row.dueDate);

    const bill: QboApImportBill = {
      sourceVendor: vendorName,
      vendorName,
      invoiceDate,
      subtotalCents: openCents,
      totalCents: openCents,
      paidCents: 0,
      status: 'APPROVED',
      notes: 'Imported from QuickBooks open A/P (opening balance).',
    };
    if (invoiceNumber) bill.invoiceNumber = invoiceNumber;
    if (dueDate) bill.dueDate = dueDate;

    bills.push(bill);
    totalOpenCents += openCents;
  }

  return { bills, warnings, totalOpenCents };
}
