// QuickBooks Online — Chart of Accounts assembler.
//
// Takes the mapped QboCoaRow[] (from qbo-coa-import.ts) and produces the
// AccountCreate[] our COA API accepts. Responsibilities:
//
//   - Drop rows whose QBO type we can't map (surfaced as `unmapped`).
//   - Assign a 5-digit account number per our convention: leading digit by
//     type (1 asset, 2 liability, ... 8 other-expense), incremented within
//     the type. If QBO already had a usable 4-6 digit number we keep it
//     (and warn if its leading digit disagrees with the mapped type).
//   - Rebuild parent links: QBO nests by name with colons; we resolve the
//     parent's freshly-assigned number so the hierarchy survives.
//
// Pure: rows in, plan out. The API route writes the plan; this never does
// I/O so it stays unit-testable and the dry-run preview is exact.

import type { AccountCreate, AccountType } from './coa';
import type { QboCoaRow } from './qbo-coa-import';
import { mapQboAccountType, splitQboAccountName } from './qbo-coa-import';

/** Account in the import plan — AccountCreate plus the QBO name it came
 *  from, so the preview UI can show the before/after mapping. */
export interface QboCoaImportAccount extends AccountCreate {
  sourceFullName: string;
}

export interface QboCoaImportResult {
  accounts: QboCoaImportAccount[];
  unmapped: Array<{ fullName: string; qboType: string; reason: string }>;
  warnings: string[];
}

export interface QboCoaImportOptions {
  /** Gap between auto-assigned numbers within a type. Default 10 — leaves
   *  room to insert accounts later. */
  numberStep?: number;
}

const TYPE_LEAD: Record<AccountType, number> = {
  ASSET: 1,
  LIABILITY: 2,
  EQUITY: 3,
  REVENUE: 4,
  COGS: 5,
  EXPENSE: 6,
  OTHER_INCOME: 7,
  OTHER_EXPENSE: 8,
};

function isUsableNumber(n: string | undefined): n is string {
  return !!n && /^\d{4,6}$/.test(n);
}

export function buildQboCoaImport(
  rows: QboCoaRow[],
  options: QboCoaImportOptions = {},
): QboCoaImportResult {
  const step = options.numberStep && options.numberStep > 0 ? options.numberStep : 10;
  const accounts: QboCoaImportAccount[] = [];
  const unmapped: QboCoaImportResult['unmapped'] = [];
  const warnings: string[] = [];

  // Track numbers we've committed so auto-assignment never collides.
  const usedNumbers = new Set<string>();
  // Per-type running counter for auto-assignment.
  const typeCounter: Partial<Record<AccountType, number>> = {};
  // fullName -> assigned number, for parent resolution (second pass).
  const nameToNumber = new Map<string, string>();
  const seenNames = new Set<string>();

  interface Staged {
    row: QboCoaRow;
    type: AccountType;
    leafName: string;
    parentName?: string;
    number: string;
  }
  const staged: Staged[] = [];

  // ---- Pass 1: map type, claim/assign numbers ----------------------------
  for (const row of rows) {
    const type = mapQboAccountType(row.qboType);
    if (!type) {
      unmapped.push({
        fullName: row.fullName,
        qboType: row.qboType,
        reason: `Unrecognized QuickBooks type "${row.qboType}"`,
      });
      continue;
    }

    if (seenNames.has(row.fullName)) {
      warnings.push(`Duplicate account name "${row.fullName}" — kept the first, skipped the rest.`);
      continue;
    }
    seenNames.add(row.fullName);

    const { parentName, leafName } = splitQboAccountName(row.fullName);

    let number: string;
    if (isUsableNumber(row.number) && !usedNumbers.has(row.number)) {
      number = row.number;
      const lead = Number(number.charAt(0));
      if (lead !== TYPE_LEAD[type]) {
        warnings.push(
          `Account "${row.fullName}" kept its QuickBooks number ${number}, but that range usually means a different account type than ${type}.`,
        );
      }
    } else {
      if (isUsableNumber(row.number) && usedNumbers.has(row.number)) {
        warnings.push(
          `Account "${row.fullName}" had QuickBooks number ${row.number}, already taken — assigned a new one.`,
        );
      }
      const base = TYPE_LEAD[type] * 10000;
      let counter = typeCounter[type] ?? 0;
      let candidate = base + counter * step;
      while (usedNumbers.has(String(candidate))) {
        counter += 1;
        candidate = base + counter * step;
      }
      typeCounter[type] = counter + 1;
      number = String(candidate);
      if (candidate >= base + 10000) {
        warnings.push(
          `Ran out of room numbering ${type} accounts near ${number} — review the COA after import.`,
        );
      }
    }

    usedNumbers.add(number);
    nameToNumber.set(row.fullName, number);
    staged.push({ row, type, leafName, parentName, number });
  }

  // ---- Pass 2: resolve parents, build AccountCreate ----------------------
  for (const s of staged) {
    let parentNumber: string | undefined;
    if (s.parentName) {
      const resolved = nameToNumber.get(s.parentName);
      if (resolved) {
        parentNumber = resolved;
      } else {
        warnings.push(
          `Account "${s.row.fullName}" lists parent "${s.parentName}", which wasn't in the import — left it top-level.`,
        );
      }
    }

    const account: QboCoaImportAccount = {
      sourceFullName: s.row.fullName,
      number: s.number,
      name: s.leafName,
      type: s.type,
      active: true,
    };
    if (parentNumber) account.parentNumber = parentNumber;
    if (s.row.detailType) account.description = `QuickBooks detail type: ${s.row.detailType}`;
    accounts.push(account);
  }

  return { accounts, unmapped, warnings };
}
