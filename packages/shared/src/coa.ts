// Chart of Accounts — the GL backbone.
//
// Drives AP invoice coding, AR revenue posting, and the Phase 2 trial
// balance + P&L + balance sheet. Account numbering follows the
// 5-digit construction convention every CA contractor / bonding-agent
// CPA expects:
//
//   1xxxx Assets
//   2xxxx Liabilities
//   3xxxx Equity
//   4xxxx Revenue (contract, T&M, retention earned)
//   5xxxx Direct job cost (labor, material, equipment, subcontract)
//   6xxxx Overhead (office, insurance, vehicles, depreciation)
//   7xxxx Other income / expense (interest, gain on sale)
//
// Phase 1 stores the COA + a default seed Brook can prune. Phase 2
// posts journal entries against these account numbers.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const AccountTypeSchema = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COGS', // direct job cost
  'EXPENSE', // overhead
  'OTHER_INCOME',
  'OTHER_EXPENSE',
]);
export type AccountType = z.infer<typeof AccountTypeSchema>;

/** Whether the account's natural balance is debit or credit. Drives
 *  trial-balance sign + the AP/AR side of journal entries. */
export type NormalBalance = 'DEBIT' | 'CREDIT';

export function normalBalanceFor(type: AccountType): NormalBalance {
  switch (type) {
    case 'ASSET':
    case 'COGS':
    case 'EXPENSE':
    case 'OTHER_EXPENSE':
      return 'DEBIT';
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
    case 'OTHER_INCOME':
      return 'CREDIT';
  }
}

export const AccountSchema = z.object({
  /** Stable id `acc-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** 5-digit account number ("10000", "51100"). */
  number: z.string().regex(/^\d{4,6}$/, 'Use 4-6 digit account number'),
  name: z.string().min(1).max(200),
  type: AccountTypeSchema,
  /** Optional parent account number for nesting (e.g. 51100 rolls up
   *  under 51000). */
  parentNumber: z.string().max(10).optional(),
  /** Marks an account inactive — keeps history intact while hiding from
   *  pickers. */
  active: z.boolean().default(true),
  /** Free-form description shown in the editor. */
  description: z.string().max(2_000).optional(),
});
export type Account = z.infer<typeof AccountSchema>;

export const AccountCreateSchema = AccountSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  active: z.boolean().optional(),
});
export type AccountCreate = z.infer<typeof AccountCreateSchema>;

export const AccountPatchSchema = AccountCreateSchema.partial();
export type AccountPatch = z.infer<typeof AccountPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function accountTypeLabel(t: AccountType, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `accountType.${t}`);
}

/** Infer account type from the leading digit. Used as a default when
 *  importing or letting the user type a number — they can still
 *  override on the editor. */
export function defaultTypeForNumber(num: string): AccountType {
  const lead = num.charAt(0);
  switch (lead) {
    case '1': return 'ASSET';
    case '2': return 'LIABILITY';
    case '3': return 'EQUITY';
    case '4': return 'REVENUE';
    case '5': return 'COGS';
    case '6': return 'EXPENSE';
    case '7': return 'OTHER_INCOME';
    case '8': return 'OTHER_EXPENSE';
    default: return 'EXPENSE';
  }
}

export interface CoaRollup {
  total: number;
  active: number;
  inactive: number;
  byType: Array<{ type: AccountType; count: number }>;
}

export function computeCoaRollup(accounts: Account[]): CoaRollup {
  let active = 0;
  let inactive = 0;
  const byTypeMap = new Map<AccountType, number>();
  for (const a of accounts) {
    if (a.active) active += 1;
    else inactive += 1;
    byTypeMap.set(a.type, (byTypeMap.get(a.type) ?? 0) + 1);
  }
  return {
    total: accounts.length,
    active,
    inactive,
    byType: Array.from(byTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type)),
  };
}

export function newAccountId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `acc-${hex.padStart(8, '0')}`;
}

// ---- Default seed --------------------------------------------------------
//
// Sensible CA heavy-civil starting COA. Brook + the bookkeeper prune
// what doesn't apply. All accounts ship as `active: true`.

export interface SeedAccount {
  number: string;
  name: string;
  type: AccountType;
  parentNumber?: string;
  description?: string;
}

export const DEFAULT_COA_SEED: ReadonlyArray<SeedAccount> = [
  // 1xxxx Assets
  { number: '10100', name: 'Operating Cash', type: 'ASSET' },
  { number: '10200', name: 'Payroll Cash', type: 'ASSET' },
  { number: '10300', name: 'Petty Cash', type: 'ASSET' },
  { number: '11000', name: 'Accounts Receivable', type: 'ASSET' },
  { number: '11100', name: 'AR — Retention Receivable', type: 'ASSET', parentNumber: '11000' },
  { number: '12000', name: 'Allowance for Doubtful Accounts', type: 'ASSET' },
  { number: '13000', name: 'Underbillings (Costs in Excess of Billings)', type: 'ASSET' },
  { number: '14000', name: 'Inventory — Materials', type: 'ASSET' },
  { number: '15000', name: 'Equipment — at cost', type: 'ASSET' },
  { number: '15100', name: 'Equipment — Accumulated Depreciation', type: 'ASSET', parentNumber: '15000' },
  { number: '15200', name: 'Vehicles — at cost', type: 'ASSET' },
  { number: '15300', name: 'Vehicles — Accumulated Depreciation', type: 'ASSET', parentNumber: '15200' },

  // 2xxxx Liabilities
  { number: '20100', name: 'Accounts Payable', type: 'LIABILITY' },
  { number: '20200', name: 'Retention Payable to Subs', type: 'LIABILITY' },
  { number: '21000', name: 'Accrued Payroll', type: 'LIABILITY' },
  { number: '21100', name: 'Payroll Tax Liability', type: 'LIABILITY' },
  { number: '21200', name: 'Workers Comp Liability', type: 'LIABILITY' },
  { number: '21300', name: 'Sales / Use Tax Payable', type: 'LIABILITY' },
  { number: '22000', name: 'Overbillings (Billings in Excess of Costs)', type: 'LIABILITY' },
  { number: '25000', name: 'Equipment Loans', type: 'LIABILITY' },
  { number: '25100', name: 'Line of Credit', type: 'LIABILITY' },

  // 3xxxx Equity
  { number: '30000', name: 'Common Stock', type: 'EQUITY' },
  { number: '32000', name: 'Retained Earnings', type: 'EQUITY' },
  { number: '33000', name: 'Distributions / Owner Draws', type: 'EQUITY' },

  // 4xxxx Revenue
  { number: '40100', name: 'Contract Revenue — Lump Sum', type: 'REVENUE' },
  { number: '40200', name: 'Contract Revenue — Unit Price', type: 'REVENUE' },
  { number: '40300', name: 'Contract Revenue — T&M', type: 'REVENUE' },
  { number: '40400', name: 'Change Order Revenue', type: 'REVENUE' },
  { number: '40500', name: 'Retention Earned', type: 'REVENUE' },

  // 5xxxx Job costs (COGS)
  { number: '51100', name: 'Direct Labor — Wages', type: 'COGS' },
  { number: '51200', name: 'Direct Labor — Payroll Tax', type: 'COGS' },
  { number: '51300', name: 'Direct Labor — Workers Comp', type: 'COGS' },
  { number: '51400', name: 'Direct Labor — Fringe (H&W / Pension / Vac)', type: 'COGS' },
  { number: '52000', name: 'Materials — Job', type: 'COGS' },
  { number: '53000', name: 'Equipment — Internal Charge', type: 'COGS' },
  { number: '53100', name: 'Equipment — Rented', type: 'COGS' },
  { number: '53200', name: 'Equipment — Fuel', type: 'COGS' },
  { number: '53300', name: 'Equipment — Repair / Parts', type: 'COGS' },
  { number: '54000', name: 'Subcontract Cost', type: 'COGS' },
  { number: '55000', name: 'Permits + Inspections — Job', type: 'COGS' },
  { number: '56000', name: 'Job-site Trucking + Hauling', type: 'COGS' },
  { number: '57000', name: 'Bond Premiums — Job', type: 'COGS' },
  { number: '58000', name: 'Other Direct Job Cost', type: 'COGS' },

  // 6xxxx Overhead
  { number: '61000', name: 'Office Salaries', type: 'EXPENSE' },
  { number: '61100', name: 'Office Payroll Tax', type: 'EXPENSE' },
  { number: '62000', name: 'Office Rent', type: 'EXPENSE' },
  { number: '62100', name: 'Office Utilities', type: 'EXPENSE' },
  { number: '62200', name: 'Office Phone + Internet', type: 'EXPENSE' },
  { number: '63000', name: 'Vehicle Expense — Office Trucks', type: 'EXPENSE' },
  { number: '64000', name: 'Insurance — General Liability', type: 'EXPENSE' },
  { number: '64100', name: 'Insurance — Auto', type: 'EXPENSE' },
  { number: '64200', name: 'Insurance — Umbrella', type: 'EXPENSE' },
  { number: '65000', name: 'Depreciation — Equipment', type: 'EXPENSE' },
  { number: '65100', name: 'Depreciation — Vehicles', type: 'EXPENSE' },
  { number: '66000', name: 'Professional Fees (CPA / Legal)', type: 'EXPENSE' },
  { number: '66100', name: 'Software + Subscriptions', type: 'EXPENSE' },
  { number: '67000', name: 'CSLB / DIR Annual Fees', type: 'EXPENSE' },
  { number: '68000', name: 'Bank Fees', type: 'EXPENSE' },
  { number: '69000', name: 'Miscellaneous Overhead', type: 'EXPENSE' },

  // 7xxxx Other income / expense
  { number: '71000', name: 'Interest Income', type: 'OTHER_INCOME' },
  { number: '72000', name: 'Gain on Sale of Equipment', type: 'OTHER_INCOME' },
  { number: '81000', name: 'Interest Expense', type: 'OTHER_EXPENSE' },
  { number: '82000', name: 'Loss on Sale of Equipment', type: 'OTHER_EXPENSE' },
];
