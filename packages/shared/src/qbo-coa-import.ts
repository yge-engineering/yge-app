// QuickBooks Online — Chart of Accounts import mapping.
//
// Plain English: QBO's "Account List" export is a CSV with columns like
// Account Name, Type, Detail Type, and (sometimes) an account number. To
// leave QuickBooks we have to bring that list into our COA model. Two
// problems to solve:
//
//   1. QBO's account "Type" vocabulary (Bank, Other Current Asset, Credit
//      Card, Cost of Goods Sold, ...) is broader than ours. We collapse it
//      onto the 8 AccountTypes our GL uses.
//   2. QBO nests accounts by name with colons ("Job Expenses:Subcontracts")
//      rather than by number. We split that into parent + leaf so the
//      assembler (next bundle) can rebuild the hierarchy with our numbers.
//
// This module is the parse + map layer: raw CSV text -> QboCoaRow[]. The
// assembler that turns those into AccountCreate[] (assigning numbers,
// linking parents) lives in qbo-coa-import-build.ts.

import type { AccountType } from './coa';
import { parseCsvObjects } from './csv';

/** One QBO account, normalized from a CSV export row. */
export interface QboCoaRow {
  /** Account number as QBO had it — often blank (QBO lets you run without
   *  account numbers). Kept as a raw string; the assembler decides whether
   *  it's usable. */
  number?: string;
  /** Full QBO name, colons intact ("Job Expenses:Subcontracts"). */
  fullName: string;
  /** QBO's account type string, verbatim ("Other Current Asset"). */
  qboType: string;
  /** QBO's detail type, verbatim ("Checking", "Subcontractors"). */
  detailType?: string;
  /** Balance column, raw string (may be blank, may have $/commas). */
  balanceRaw?: string;
}

/**
 * Map a QBO account-type string onto our AccountType. Case- and
 * whitespace-insensitive. Returns null for anything we don't recognize so
 * the caller can surface it as an unmapped row rather than guessing.
 */
export function mapQboAccountType(qboType: string): AccountType | null {
  const k = qboType.trim().toLowerCase().replace(/\s+/g, ' ');
  switch (k) {
    // Assets
    case 'bank':
    case 'accounts receivable':
    case 'a/r':
    case 'other current asset':
    case 'other current assets':
    case 'fixed asset':
    case 'fixed assets':
    case 'other asset':
    case 'other assets':
      return 'ASSET';
    // Liabilities
    case 'accounts payable':
    case 'a/p':
    case 'credit card':
    case 'other current liability':
    case 'other current liabilities':
    case 'long term liability':
    case 'long term liabilities':
      return 'LIABILITY';
    case 'equity':
      return 'EQUITY';
    case 'income':
    case 'revenue':
      return 'REVENUE';
    case 'cost of goods sold':
    case 'cogs':
      return 'COGS';
    case 'expense':
    case 'expenses':
      return 'EXPENSE';
    case 'other income':
      return 'OTHER_INCOME';
    case 'other expense':
    case 'other expenses':
      return 'OTHER_EXPENSE';
    default:
      return null;
  }
}

/**
 * Split a QBO colon-nested account name into parent + leaf.
 *
 *   "Bank"                          -> { leafName: 'Bank' }
 *   "Job Expenses:Subcontracts"     -> { parentName: 'Job Expenses', leafName: 'Subcontracts' }
 *   "A:B:C"                         -> { parentName: 'A:B', leafName: 'C' }
 *
 * Whitespace around each segment is trimmed (QBO sometimes emits
 * "Parent : Child").
 */
export function splitQboAccountName(fullName: string): {
  parentName?: string;
  leafName: string;
} {
  const segments = fullName
    .split(':')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (segments.length <= 1) {
    return { leafName: segments[0] ?? fullName.trim() };
  }
  const leafName = segments[segments.length - 1]!;
  const parentName = segments.slice(0, -1).join(':');
  return { parentName, leafName };
}

// ---- Header-tolerant column resolution ----------------------------------

/** Find the first object key (case-insensitive) matching any candidate. */
function pickKey(
  obj: Record<string, string>,
  candidates: readonly string[],
): string | undefined {
  const lowerToActual = new Map<string, string>();
  for (const k of Object.keys(obj)) lowerToActual.set(k.toLowerCase(), k);
  for (const c of candidates) {
    const actual = lowerToActual.get(c.toLowerCase());
    if (actual !== undefined) return actual;
  }
  return undefined;
}

const NAME_HEADERS = ['Account Name', 'Name', 'Full Name', 'Full name', 'Account'];
const TYPE_HEADERS = ['Type', 'Account Type'];
const DETAIL_HEADERS = ['Detail Type', 'Detail type'];
const NUMBER_HEADERS = ['Account #', 'Account Number', 'Number', 'Acct #', 'No.'];
const BALANCE_HEADERS = ['Balance', 'Balance Total', 'Total Balance', 'Balance ($)'];

/**
 * Parse a QBO Chart-of-Accounts CSV export into QboCoaRow[]. Tolerant of
 * the various header spellings QBO uses across versions / locales. Rows
 * missing both a name and a type are skipped (trailing summary lines).
 */
export function coaRowsFromCsv(csv: string): QboCoaRow[] {
  const objects = parseCsvObjects(csv);
  if (objects.length === 0) return [];

  const sample = objects[0]!;
  const nameKey = pickKey(sample, NAME_HEADERS);
  const typeKey = pickKey(sample, TYPE_HEADERS);
  const detailKey = pickKey(sample, DETAIL_HEADERS);
  const numberKey = pickKey(sample, NUMBER_HEADERS);
  const balanceKey = pickKey(sample, BALANCE_HEADERS);

  const out: QboCoaRow[] = [];
  for (const row of objects) {
    const fullName = (nameKey ? row[nameKey] : '')?.trim() ?? '';
    const qboType = (typeKey ? row[typeKey] : '')?.trim() ?? '';
    // Skip blank / summary lines (no name AND no type).
    if (fullName.length === 0 && qboType.length === 0) continue;

    const numberVal = numberKey ? row[numberKey]?.trim() : undefined;
    const detailVal = detailKey ? row[detailKey]?.trim() : undefined;
    const balanceVal = balanceKey ? row[balanceKey]?.trim() : undefined;

    out.push({
      fullName,
      qboType,
      number: numberVal && numberVal.length > 0 ? numberVal : undefined,
      detailType: detailVal && detailVal.length > 0 ? detailVal : undefined,
      balanceRaw: balanceVal && balanceVal.length > 0 ? balanceVal : undefined,
    });
  }
  return out;
}
