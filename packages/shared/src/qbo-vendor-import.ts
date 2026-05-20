// QuickBooks Online — vendor list import mapping.
//
// QBO "Vendor Contact List" export -> VendorCreate[]. Maps contact / address
// / tax id straight across; normalizes QBO's free-text payment terms onto
// our enum; guesses vendor kind from the name; and sets 1099 reporting from
// the QBO "Track 1099" column when present, otherwise from the guessed kind
// (subs / professional / trucking default to reportable).

import type { VendorCreate, VendorKind, VendorPaymentTerms } from './vendor';
import { parseCsvObjects } from './csv';

export interface QboVendorRow {
  displayName: string;
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  zip?: string;
  terms?: string;
  accountNumber?: string;
  taxId?: string;
  track1099?: string;
}

/** Best-guess vendor kind from the name. Conservative — strong signals
 *  only, else OTHER. */
export function inferVendorKind(name: string): VendorKind {
  const n = name.toLowerCase();
  if (/\b(trucking|hauling|transport|freight)/.test(n)) return 'TRUCKING';
  if (/\b(rental|equipment co|cat rental|sunbelt|united rentals)/.test(n)) return 'EQUIPMENT_RENTAL';
  if (/\b(engineering|engineer|consult|attorney|law (group|office)|cpa|accounting|surveyor|geotech)/.test(n)) return 'PROFESSIONAL';
  if (/\b(pg&e|pacific gas|water district|power|electric co|utility|waste management|disposal)/.test(n)) return 'UTILITY';
  if (/\b(county of|city of|state of|department of|permit|caltrans|cal fire)/.test(n)) return 'GOVERNMENT';
  if (/\b(supply|materials|aggregate|ready.?mix|readymix|lumber|steel|pipe|sand and gravel|quarry|hardware)/.test(n)) return 'SUPPLIER';
  if (/\b(construction|excavat|grading|paving|electric|plumbing|concrete|contractor|builders|fencing|striping|landscap)/.test(n)) return 'SUBCONTRACTOR';
  return 'OTHER';
}

/** Normalize a QBO terms string onto our enum. Returns undefined when
 *  unrecognized so the VendorCreate default (NET_30) applies. */
export function mapVendorPaymentTerms(raw: string | undefined): VendorPaymentTerms | undefined {
  if (!raw) return undefined;
  const k = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^net ?10$/.test(k)) return 'NET_10';
  if (/^net ?15$/.test(k)) return 'NET_15';
  if (/^net ?30$/.test(k)) return 'NET_30';
  if (/^net ?45$/.test(k)) return 'NET_45';
  if (/^net ?60$/.test(k)) return 'NET_60';
  if (/due on receipt|^dor$/.test(k)) return 'DUE_ON_RECEIPT';
  if (/^cod$|cash on delivery/.test(k)) return 'COD';
  if (/prepaid|prepay/.test(k)) return 'PREPAID';
  return 'OTHER';
}

function parseBoolish(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const k = raw.trim().toLowerCase();
  if (k.length === 0) return undefined;
  if (/^(yes|y|true|1|x)$/.test(k)) return true;
  if (/^(no|n|false|0)$/.test(k)) return false;
  return undefined;
}

function reportableDefaultForKind(kind: VendorKind): boolean {
  return kind === 'SUBCONTRACTOR' || kind === 'PROFESSIONAL' || kind === 'TRUCKING';
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
  display: ['Vendor', 'Vendor full name', 'Display Name', 'Name'],
  company: ['Company', 'Company Name'],
  contact: ['Full Name', 'Contact', 'Primary Contact', 'Contact Name'],
  phone: ['Phone', 'Phone Numbers', 'Main Phone', 'Phone Number'],
  email: ['Email', 'Email Address', 'Main Email'],
  line1: ['Billing Street', 'Street', 'Address', 'Bill to Street'],
  city: ['Billing City', 'City'],
  state: ['Billing State', 'State', 'Province'],
  zip: ['Billing ZIP', 'Billing Zip', 'ZIP', 'Zip', 'Postal Code'],
  terms: ['Terms', 'Payment Terms'],
  account: ['Account No.', 'Account #', 'Account Number', 'Acct No'],
  taxId: ['Tax ID', 'Business ID No.', 'Tax ID No.', 'EIN', 'Tax Identifier'],
  track1099: ['Track 1099', '1099', 'Eligible for 1099', 'Track payments for 1099'],
} as const;

function val(row: Record<string, string>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const v = row[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

export function vendorRowsFromCsv(csv: string): QboVendorRow[] {
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
    city: pickKey(s, H.city),
    state: pickKey(s, H.state),
    zip: pickKey(s, H.zip),
    terms: pickKey(s, H.terms),
    account: pickKey(s, H.account),
    taxId: pickKey(s, H.taxId),
    track1099: pickKey(s, H.track1099),
  };

  const out: QboVendorRow[] = [];
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
      addressLine: val(row, keys.line1),
      city: val(row, keys.city),
      state: val(row, keys.state),
      zip: val(row, keys.zip),
      terms: val(row, keys.terms),
      accountNumber: val(row, keys.account),
      taxId: val(row, keys.taxId),
      track1099: val(row, keys.track1099),
    });
  }
  return out;
}

export interface QboVendorImportAccount extends VendorCreate {
  sourceName: string;
}

export interface QboVendorImportResult {
  vendors: QboVendorImportAccount[];
  warnings: string[];
}

export function buildQboVendorImport(rows: QboVendorRow[]): QboVendorImportResult {
  const vendors: QboVendorImportAccount[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const legalName = (row.companyName ?? row.displayName).trim();
    if (legalName.length === 0) {
      warnings.push('Skipped a row with no vendor or company name.');
      continue;
    }
    const key = legalName.toLowerCase();
    if (seen.has(key)) {
      warnings.push(`Duplicate vendor "${legalName}" in the file — kept the first.`);
      continue;
    }
    seen.add(key);

    const dbaName =
      row.displayName && row.displayName.trim().toLowerCase() !== legalName.toLowerCase()
        ? row.displayName.trim()
        : undefined;

    const kind = inferVendorKind(legalName + ' ' + (dbaName ?? ''));
    const explicit1099 = parseBoolish(row.track1099);
    const is1099Reportable = explicit1099 ?? reportableDefaultForKind(kind);
    const terms = mapVendorPaymentTerms(row.terms);

    const vendor: QboVendorImportAccount = {
      sourceName: row.displayName,
      legalName,
      kind,
      is1099Reportable,
    };
    if (dbaName) vendor.dbaName = dbaName;
    if (terms) vendor.paymentTerms = terms;
    if (row.taxId) vendor.taxId = row.taxId;
    if (row.contactName) vendor.contactName = row.contactName;
    if (row.phone) vendor.phone = row.phone;
    if (row.email) vendor.email = row.email;
    if (row.addressLine) vendor.addressLine = row.addressLine;
    if (row.city) vendor.city = row.city;
    if (row.state) vendor.state = row.state;
    if (row.zip) vendor.zip = row.zip;
    if (row.accountNumber) vendor.accountNumber = row.accountNumber;

    vendors.push(vendor);
  }
  return { vendors, warnings };
}
