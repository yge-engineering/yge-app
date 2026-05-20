// QuickBooks Online — customer list import mapping.
//
// QBO's "Customer Contact List" export -> our CustomerCreate[]. QBO doesn't
// carry our customer "kind" (state agency vs county vs private), so we infer
// a best-guess from the name and let the user re-classify in the preview /
// the customer record. Everything else (contact, phone, email, billing
// address, terms) maps straight across when present.

import type { CustomerCreate, CustomerKind } from './customer';
import { parseCsvObjects } from './csv';

export interface QboCustomerRow {
  /** QBO "Customer" display name — always present. */
  displayName: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  billingLine1?: string;
  billingLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  terms?: string;
}

/**
 * Best-guess customer kind from the name. Conservative: only fires on
 * strong signals, everything else falls to OTHER so the user reclassifies
 * deliberately rather than trusting a wrong guess.
 */
export function inferCustomerKind(name: string): CustomerKind {
  const n = name.toLowerCase();
  if (/\b(cal\s?fire|caltrans|dgs|state of california|department of (transportation|forestry|general services))\b/.test(n)) {
    return 'STATE_AGENCY';
  }
  if (/\b(blm|bureau of land management|u\.?s\.? forest service|usfs|national forest|federal highway|army corps)\b/.test(n)) {
    return 'FEDERAL_AGENCY';
  }
  if (/\bcounty\b/.test(n)) return 'COUNTY';
  if (/\bcity of\b|\btown of\b/.test(n)) return 'CITY';
  if (/\b(school district|water district|irrigation district|fire protection district|special district|unified)\b/.test(n)) {
    return 'SPECIAL_DISTRICT';
  }
  if (/\b(inc|llc|corp|construction|builders|contractors|company|co\.)\b/.test(n)) {
    return 'PRIVATE_OWNER';
  }
  return 'OTHER';
}

// ---- header resolution ---------------------------------------------------

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
  display: ['Customer', 'Customer full name', 'Display Name', 'Name'],
  company: ['Company', 'Company Name'],
  contact: ['Full Name', 'Contact', 'Primary Contact', 'Contact Name'],
  phone: ['Phone', 'Phone Numbers', 'Main Phone', 'Phone Number'],
  email: ['Email', 'Email Address', 'Main Email'],
  line1: ['Billing Street', 'Bill to Street', 'Billing Address', 'Street', 'Address'],
  line2: ['Billing Street 2', 'Bill to Street 2', 'Address 2'],
  city: ['Billing City', 'City'],
  state: ['Billing State', 'State', 'Province'],
  zip: ['Billing ZIP', 'Billing Zip', 'ZIP', 'Zip', 'Postal Code'],
  terms: ['Terms', 'Payment Terms'],
} as const;

function val(row: Record<string, string>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const v = row[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

/** Parse a QBO customer CSV export into QboCustomerRow[]. Rows with no
 *  display name AND no company name are dropped (summary lines). */
export function customerRowsFromCsv(csv: string): QboCustomerRow[] {
  const objects = parseCsvObjects(csv);
  if (objects.length === 0) return [];
  const s = objects[0]!;
  const keys = {
    display: pickKey(s, H.display),
    company: pickKey(s, H.company),
    contact: pickKey(s, H.contact),
    phone: pickKey(s, H.phone),
    email: pickKey(s, H.email),
    line1: pickKey(s, H.line1),
    line2: pickKey(s, H.line2),
    city: pickKey(s, H.city),
    state: pickKey(s, H.state),
    zip: pickKey(s, H.zip),
    terms: pickKey(s, H.terms),
  };

  const out: QboCustomerRow[] = [];
  for (const row of objects) {
    const displayName = val(row, keys.display) ?? '';
    const companyName = val(row, keys.company);
    if (displayName.length === 0 && !companyName) continue;
    out.push({
      displayName: displayName.length > 0 ? displayName : companyName!,
      companyName,
      contactName: val(row, keys.contact),
      phone: val(row, keys.phone),
      email: val(row, keys.email),
      billingLine1: val(row, keys.line1),
      billingLine2: val(row, keys.line2),
      city: val(row, keys.city),
      state: val(row, keys.state),
      zip: val(row, keys.zip),
      terms: val(row, keys.terms),
    });
  }
  return out;
}

export interface QboCustomerImportAccount extends CustomerCreate {
  /** QBO name this came from, for the preview. */
  sourceName: string;
}

export interface QboCustomerImportResult {
  customers: QboCustomerImportAccount[];
  warnings: string[];
}

/** Turn QBO customer rows into CustomerCreate[]. legalName prefers the
 *  company name; the display name becomes the DBA when it differs. */
export function buildQboCustomerImport(rows: QboCustomerRow[]): QboCustomerImportResult {
  const customers: QboCustomerImportAccount[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const legalName = (row.companyName ?? row.displayName).trim();
    if (legalName.length === 0) {
      warnings.push('Skipped a row with no customer or company name.');
      continue;
    }
    const dedupKey = legalName.toLowerCase();
    if (seen.has(dedupKey)) {
      warnings.push(`Duplicate customer "${legalName}" in the file — kept the first.`);
      continue;
    }
    seen.add(dedupKey);

    const dbaName =
      row.displayName && row.displayName.trim().toLowerCase() !== legalName.toLowerCase()
        ? row.displayName.trim()
        : undefined;

    const customer: QboCustomerImportAccount = {
      sourceName: row.displayName,
      legalName,
      kind: inferCustomerKind(legalName + ' ' + (dbaName ?? '')),
      taxExempt: false,
      onHold: false,
    };
    if (dbaName) customer.dbaName = dbaName;
    if (row.contactName) customer.contactName = row.contactName;
    if (row.phone) customer.phone = row.phone;
    if (row.email) customer.email = row.email;
    if (row.billingLine1) customer.billingAddressLine = row.billingLine1;
    if (row.billingLine2) customer.billingAddressLine2 = row.billingLine2;
    if (row.city) customer.city = row.city;
    if (row.state) customer.state = row.state;
    if (row.zip) customer.zip = row.zip;
    if (row.terms) customer.paymentTerms = row.terms;

    customers.push(customer);
  }
  return { customers, warnings };
}
