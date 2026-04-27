// Journal entry — the GL posting record.
//
// Every AP invoice / AR invoice / payroll run / receipt / cash transfer
// either auto-posts or hand-posts a journal entry against the chart of
// accounts. A JE is the canonical place where the books move.
//
// Hard rule: a JE must balance. Sum of debit lines must equal sum of
// credit lines, to the cent. The schema enforces this at parse time
// via a refine; the API store calls .parse() before persisting.
//
// Phase 1 stores manual + auto JEs in one stream, with a `source`
// discriminator + `sourceRef` so we can find every JE that came from
// a given AP invoice. Phase 2 walks all posted JEs to build the
// trial balance.

import { z } from 'zod';

export const JournalEntrySourceSchema = z.enum([
  'MANUAL',
  'AP_INVOICE',
  'AP_PAYMENT',
  'AR_INVOICE',
  'AR_PAYMENT',
  'PAYROLL',
  'DEPRECIATION',
  'CASH_TRANSFER',
  'ADJUSTING',
  'CLOSING',
  'OTHER',
]);
export type JournalEntrySource = z.infer<typeof JournalEntrySourceSchema>;

export const JournalEntryStatusSchema = z.enum([
  'DRAFT',     // building it; doesn't affect TB yet
  'POSTED',    // posted to the GL; appears in trial balance
  'VOIDED',    // posted-then-reversed; kept for audit
]);
export type JournalEntryStatus = z.infer<typeof JournalEntryStatusSchema>;

export const JournalEntryLineSchema = z
  .object({
    /** GL account number (matches Account.number on the COA). */
    accountNumber: z.string().regex(/^\d{4,6}$/, 'Use 4-6 digit account number'),
    /** Debit amount in cents. Exactly one of debit or credit must be > 0. */
    debitCents: z.number().int().nonnegative().default(0),
    /** Credit amount in cents. */
    creditCents: z.number().int().nonnegative().default(0),
    /** Optional per-line memo. */
    memo: z.string().max(500).optional(),
    /** Optional job tag for cost-coded lines. */
    jobId: z.string().max(120).optional(),
  })
  .refine(
    (l) => (l.debitCents > 0) !== (l.creditCents > 0),
    'Each line must be either a debit or a credit, not both / neither',
  );
export type JournalEntryLine = z.infer<typeof JournalEntryLineSchema>;

export const JournalEntrySchema = z
  .object({
    /** Stable id `je-<8hex>`. */
    id: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),

    /** Posting date (yyyy-mm-dd). */
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
    /** Free-form description printed at the top of the JE. */
    memo: z.string().min(1).max(500),

    source: JournalEntrySourceSchema.default('MANUAL'),
    /** Cross-reference to whatever produced this JE (e.g. an AP invoice
     *  id). Empty for hand-keyed JEs. */
    sourceRef: z.string().max(120).optional(),

    status: JournalEntryStatusSchema.default('DRAFT'),
    /** Time the JE was posted. */
    postedAt: z.string().optional(),
    /** Time the JE was voided. */
    voidedAt: z.string().optional(),

    lines: z.array(JournalEntryLineSchema).min(2),

    /** Free-form internal notes — not printed. */
    notes: z.string().max(10_000).optional(),
  })
  .refine(
    (je) => sumLineCents(je.lines, 'debitCents') === sumLineCents(je.lines, 'creditCents'),
    'Sum of debits must equal sum of credits',
  );
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

function sumLineCents(
  lines: JournalEntryLine[],
  field: 'debitCents' | 'creditCents',
): number {
  let total = 0;
  for (const l of lines) total += l[field];
  return total;
}

export const JournalEntryCreateSchema = JournalEntrySchema.innerType()
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    source: JournalEntrySourceSchema.optional(),
    status: JournalEntryStatusSchema.optional(),
  })
  .refine(
    (je) => sumLineCents(je.lines, 'debitCents') === sumLineCents(je.lines, 'creditCents'),
    'Sum of debits must equal sum of credits',
  );
export type JournalEntryCreate = z.infer<typeof JournalEntryCreateSchema>;

export const JournalEntryPatchSchema = JournalEntrySchema.innerType()
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();
export type JournalEntryPatch = z.infer<typeof JournalEntryPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function journalEntrySourceLabel(s: JournalEntrySource): string {
  switch (s) {
    case 'MANUAL': return 'Manual';
    case 'AP_INVOICE': return 'AP invoice';
    case 'AP_PAYMENT': return 'AP payment';
    case 'AR_INVOICE': return 'AR invoice';
    case 'AR_PAYMENT': return 'AR payment';
    case 'PAYROLL': return 'Payroll';
    case 'DEPRECIATION': return 'Depreciation';
    case 'CASH_TRANSFER': return 'Cash transfer';
    case 'ADJUSTING': return 'Adjusting';
    case 'CLOSING': return 'Closing';
    case 'OTHER': return 'Other';
  }
}

export function journalEntryStatusLabel(s: JournalEntryStatus): string {
  switch (s) {
    case 'DRAFT': return 'Draft';
    case 'POSTED': return 'Posted';
    case 'VOIDED': return 'Voided';
  }
}

export function totalDebitCents(je: Pick<JournalEntry, 'lines'>): number {
  return sumLineCents(je.lines, 'debitCents');
}
export function totalCreditCents(je: Pick<JournalEntry, 'lines'>): number {
  return sumLineCents(je.lines, 'creditCents');
}
export function isBalanced(je: Pick<JournalEntry, 'lines'>): boolean {
  return totalDebitCents(je) === totalCreditCents(je);
}

export interface JournalEntryRollup {
  total: number;
  draft: number;
  posted: number;
  voided: number;
  /** Total $ posted (sum of debits across POSTED entries). */
  postedDebitCents: number;
}

export function computeJournalEntryRollup(entries: JournalEntry[]): JournalEntryRollup {
  let draft = 0;
  let posted = 0;
  let voided = 0;
  let postedDebitCents = 0;
  for (const je of entries) {
    if (je.status === 'DRAFT') draft += 1;
    else if (je.status === 'POSTED') {
      posted += 1;
      postedDebitCents += totalDebitCents(je);
    } else if (je.status === 'VOIDED') voided += 1;
  }
  return {
    total: entries.length,
    draft,
    posted,
    voided,
    postedDebitCents,
  };
}

/** Trial balance roll-up by account number — sum debits − sum credits
 *  for all POSTED entries. Phase 2 will reuse this as the foundation
 *  for the actual TB / P&L / balance sheet pages. */
export interface AccountBalance {
  accountNumber: string;
  debitCents: number;
  creditCents: number;
  /** debit − credit. Positive = debit balance, negative = credit. */
  balanceCents: number;
}

export function computeAccountBalances(
  entries: JournalEntry[],
): AccountBalance[] {
  const map = new Map<string, { debitCents: number; creditCents: number }>();
  for (const je of entries) {
    if (je.status !== 'POSTED') continue;
    for (const line of je.lines) {
      const cur = map.get(line.accountNumber) ?? { debitCents: 0, creditCents: 0 };
      cur.debitCents += line.debitCents;
      cur.creditCents += line.creditCents;
      map.set(line.accountNumber, cur);
    }
  }
  return Array.from(map.entries())
    .map(([accountNumber, { debitCents, creditCents }]) => ({
      accountNumber,
      debitCents,
      creditCents,
      balanceCents: debitCents - creditCents,
    }))
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
}

export function newJournalEntryId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `je-${hex.padStart(8, '0')}`;
}
