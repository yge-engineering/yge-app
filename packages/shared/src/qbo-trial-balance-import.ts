// QuickBooks Online — Trial Balance -> opening journal entry.
//
// Source: QBO "Trial Balance" CSV as of the cutover date — one row per
// account with a Debit or Credit column. To stand up the GL we post ONE
// balanced journal entry that reproduces those balances.
//
// Account matching is by number first (QBO often prints "12000 · Name"),
// then by full name, then by the leaf of a colon-nested name. Anything we
// can't match — plus any rounding — is absorbed by a plug to "Opening
// Balance Equity" (39000), exactly as QuickBooks itself does on setup, so
// the entry always balances and nothing is silently dropped.

import type { Account } from './coa';
import { parseCsvObjects } from './csv';
import type { JournalEntryCreate, JournalEntryLine } from './journal-entry';
import { parseQboAmountToCents } from './qbo-parse';

export const OPENING_BALANCE_EQUITY_NUMBER = '39000';
export const OPENING_BALANCE_EQUITY_NAME = 'Opening Balance Equity';

export interface QboTrialBalanceRow {
  accountRef: string;
  debit?: string;
  credit?: string;
}

export interface TbMatchedLine {
  accountNumber: string;
  accountName: string;
  debitCents: number;
  creditCents: number;
}

export interface TbUnmatched {
  accountRef: string;
  netDebitCents: number;
  reason: string;
}

export interface QboTrialBalanceImportResult {
  /** Balanced JournalEntryCreate, or null when fewer than two lines result. */
  entry: JournalEntryCreate | null;
  matched: TbMatchedLine[];
  unmatched: TbUnmatched[];
  /** Net debit folded into Opening Balance Equity (signed; +debit / -credit). */
  plugNetDebitCents: number;
  warnings: string[];
  totalDebitCents: number;
  totalCreditCents: number;
}

export interface QboTrialBalanceImportOptions {
  /** Cutover / posting date, yyyy-mm-dd. */
  entryDate: string;
  /** Memo printed on the entry. Defaults to a sensible opening-balance note. */
  memo?: string;
  /** Plug account number. Defaults to 39000 Opening Balance Equity. */
  openingEquityNumber?: string;
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
  account: ['Account', 'Account Name', 'Name', ''],
  debit: ['Debit', 'Debits', 'Dr'],
  credit: ['Credit', 'Credits', 'Cr'],
} as const;

export function tbRowsFromCsv(csv: string): QboTrialBalanceRow[] {
  const objects = parseCsvObjects(csv);
  if (objects.length === 0) return [];
  const s = objects[0]!;
  const accountKey = pickKey(s, H.account);
  const debitKey = pickKey(s, H.debit);
  const creditKey = pickKey(s, H.credit);

  const out: QboTrialBalanceRow[] = [];
  for (const row of objects) {
    const accountRef = (accountKey ? row[accountKey] : '')?.trim() ?? '';
    const debit = debitKey ? row[debitKey]?.trim() : undefined;
    const credit = creditKey ? row[creditKey]?.trim() : undefined;
    // Skip the TOTAL line and any row with no account label.
    if (accountRef.length === 0) continue;
    if (/^total\b/i.test(accountRef)) continue;
    out.push({ accountRef, debit, credit });
  }
  return out;
}

/** Strip a leading account number + separator and return the trailing label. */
function stripLeadingNumber(ref: string): string {
  return ref.replace(/^\s*\d{4,6}\s*[·:\-–]?\s*/, '').trim();
}

/** Leaf of a colon/middot-nested name. */
function leafOf(name: string): string {
  const parts = name.split(/[:·–]/).map((p) => p.trim()).filter((p) => p.length > 0);
  return parts[parts.length - 1] ?? name.trim();
}

export function buildQboTrialBalanceImport(
  rows: QboTrialBalanceRow[],
  accounts: Account[],
  options: QboTrialBalanceImportOptions,
): QboTrialBalanceImportResult {
  const equityNumber =
    options.openingEquityNumber && /^\d{4,6}$/.test(options.openingEquityNumber)
      ? options.openingEquityNumber
      : OPENING_BALANCE_EQUITY_NUMBER;

  const numberSet = new Set(accounts.map((a) => a.number));
  const nameToNumber = new Map<string, string>();
  const leafToNumber = new Map<string, string>();
  const numberToName = new Map<string, string>();
  for (const a of accounts) {
    numberToName.set(a.number, a.name);
    nameToNumber.set(a.name.trim().toLowerCase(), a.number);
    leafToNumber.set(leafOf(a.name).toLowerCase(), a.number);
  }

  const warnings: string[] = [];
  const unmatched: TbUnmatched[] = [];
  // accountNumber -> accumulated net debit cents
  const acc = new Map<string, number>();

  function addNet(number: string, netDebit: number): void {
    acc.set(number, (acc.get(number) ?? 0) + netDebit);
  }

  for (const row of rows) {
    const debitCents = parseQboAmountToCents(row.debit) ?? 0;
    const creditCents = parseQboAmountToCents(row.credit) ?? 0;
    const netDebit = debitCents - creditCents;
    if (netDebit === 0) continue;

    // 1) leading number.
    let matchedNumber: string | undefined;
    const numMatch = /^\s*(\d{4,6})\b/.exec(row.accountRef);
    if (numMatch && numberSet.has(numMatch[1]!)) {
      matchedNumber = numMatch[1]!;
    }
    // 2) full name (number stripped).
    if (!matchedNumber) {
      const label = stripLeadingNumber(row.accountRef).toLowerCase();
      matchedNumber = nameToNumber.get(label);
    }
    // 3) leaf name.
    if (!matchedNumber) {
      const leaf = leafOf(stripLeadingNumber(row.accountRef)).toLowerCase();
      matchedNumber = leafToNumber.get(leaf);
    }

    if (!matchedNumber) {
      unmatched.push({
        accountRef: row.accountRef,
        netDebitCents: netDebit,
        reason: 'No matching account in the chart of accounts',
      });
      continue;
    }
    addNet(matchedNumber, netDebit);
  }

  // Compute the plug needed to balance, then fold it into Opening Balance
  // Equity (so it shows as one clean line, even if some balance already
  // landed there).
  let totalMatchedNetDebit = 0;
  for (const v of acc.values()) totalMatchedNetDebit += v;
  const plugNetDebitCents = totalMatchedNetDebit === 0 ? 0 : -totalMatchedNetDebit;
  if (plugNetDebitCents !== 0) {
    addNet(equityNumber, plugNetDebitCents);
    if (!numberSet.has(equityNumber)) {
      warnings.push(
        `Plugged ${formatSigned(plugNetDebitCents)} to ${equityNumber} ${OPENING_BALANCE_EQUITY_NAME} (will be created if missing).`,
      );
    } else {
      warnings.push(
        `Plugged ${formatSigned(plugNetDebitCents)} to ${equityNumber} ${numberToName.get(equityNumber) ?? OPENING_BALANCE_EQUITY_NAME}.`,
      );
    }
  }
  if (unmatched.length > 0) {
    warnings.push(
      `${unmatched.length} trial-balance account${unmatched.length === 1 ? '' : 's'} couldn't be matched — their balances were absorbed by Opening Balance Equity. Map them in the COA and re-import for a clean ledger.`,
    );
  }

  const matched: TbMatchedLine[] = [];
  const lines: JournalEntryLine[] = [];
  let totalDebitCents = 0;
  let totalCreditCents = 0;
  for (const [number, netDebit] of acc.entries()) {
    if (netDebit === 0) continue;
    const debitCents = netDebit > 0 ? netDebit : 0;
    const creditCents = netDebit < 0 ? -netDebit : 0;
    const accountName =
      numberToName.get(number) ??
      (number === equityNumber ? OPENING_BALANCE_EQUITY_NAME : number);
    matched.push({ accountNumber: number, accountName, debitCents, creditCents });
    lines.push({ accountNumber: number, debitCents, creditCents });
    totalDebitCents += debitCents;
    totalCreditCents += creditCents;
  }

  // Stable sort: by account number ascending so the entry reads top-down.
  matched.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  lines.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

  let entry: JournalEntryCreate | null = null;
  if (lines.length >= 2) {
    entry = {
      entryDate: options.entryDate,
      memo: options.memo ?? `QuickBooks opening balances as of ${options.entryDate}`,
      source: 'OTHER',
      status: 'DRAFT',
      lines,
      notes: 'Imported from a QuickBooks Trial Balance export.',
    };
  } else {
    warnings.push('Not enough matched accounts to form a journal entry (need at least two lines).');
  }

  return {
    entry,
    matched,
    unmatched,
    plugNetDebitCents,
    warnings,
    totalDebitCents,
    totalCreditCents,
  };
}

function formatSigned(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
