// Resolve the GL accounts used by invoice posting from the actual chart of
// accounts, matched by type + name. This decouples AR/AP posting from any
// hardcoded numbering — whether the COA was seeded or imported from
// QuickBooks (which assigns its own numbers), posting still finds the right
// control / revenue / expense accounts.

import type { Account } from './coa';
import { AR_POSTING_DEFAULTS } from './ar-invoice-posting';
import { AP_POSTING_DEFAULTS } from './ap-invoice-posting';

export interface ResolvedPostingAccounts {
  arControl: string;
  arRetention?: string;
  revenue: string;
  salesTax?: string;
  apControl: string;
  defaultExpense: string;
  /** Notes for any account that fell back to a seed default. */
  warnings: string[];
}

function activeByType(accounts: Account[], type: Account['type']): Account[] {
  return accounts
    .filter((a) => a.type === type && a.active !== false)
    .sort((a, b) => a.number.localeCompare(b.number));
}

/** First account whose name matches `prefer` and (optionally) does not match
 *  `exclude`. Candidates are pre-sorted by number, so ties favor the lowest
 *  (most general) account. */
function pick(candidates: Account[], prefer: RegExp, exclude?: RegExp): Account | undefined {
  return candidates.find((a) => prefer.test(a.name) && (!exclude || !exclude.test(a.name)));
}

export function resolvePostingAccounts(accounts: Account[]): ResolvedPostingAccounts {
  const warnings: string[] = [];
  const fallback = (value: string, label: string): string => {
    warnings.push(`Couldn't find a ${label} account in the chart of accounts — used default ${value}. Set it on the right account (or rename it) for accurate posting.`);
    return value;
  };

  const assets = activeByType(accounts, 'ASSET');
  const liabilities = activeByType(accounts, 'LIABILITY');
  const revenues = activeByType(accounts, 'REVENUE');
  const cogs = activeByType(accounts, 'COGS');
  const expenses = activeByType(accounts, 'EXPENSE');

  const arAcc = pick(assets, /accounts receivable|\ba\/r\b|receivable/i, /retention/i);
  const arControl = arAcc?.number ?? fallback(AR_POSTING_DEFAULTS.arControl, 'A/R control');

  const arRetentionAcc = pick(assets, /retention/i, /payable/i);
  const arRetention = arRetentionAcc?.number;

  const revAcc = pick(revenues, /contract revenue/i) ?? revenues[0];
  const revenue = revAcc?.number ?? fallback(AR_POSTING_DEFAULTS.revenue, 'revenue');

  const taxAcc = pick(liabilities, /sales.*tax|use tax|tax payable/i);
  const salesTax = taxAcc?.number;

  const apAcc = pick(liabilities, /accounts payable|\ba\/p\b|payable/i, /retention|sub/i);
  const apControl = apAcc?.number ?? fallback(AP_POSTING_DEFAULTS.apControl, 'A/P control');

  const expAcc = pick(cogs, /other direct job cost|other direct cost|uncategor/i) ?? cogs[0] ?? expenses[0];
  const defaultExpense = expAcc?.number ?? fallback(AP_POSTING_DEFAULTS.defaultExpense, 'default expense');

  return {
    arControl,
    ...(arRetention ? { arRetention } : {}),
    revenue,
    ...(salesTax ? { salesTax } : {}),
    apControl,
    defaultExpense,
    warnings,
  };
}
