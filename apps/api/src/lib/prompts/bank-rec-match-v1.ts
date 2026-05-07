// Bank-rec match prompt — v1.
//
// Versioning rule (per CLAUDE.md): one file per use-case version.
// When the prompt changes meaningfully, copy this file to v2, bump
// PROMPT_VERSION, and update the service import. Keep old versions
// around for retro testing.

export const PROMPT_VERSION = 'bank-rec-match@1.0.0';

export const SYSTEM_PROMPT = [
  'You are matching bank-statement transactions to a list of open',
  'bookkeeping rows for Young General Engineering, a California',
  'heavy-civil contractor. Every dollar amount is integer cents.',
  '',
  'You receive two arrays:',
  '  1. transactions[] — rows from a bank statement: date, description,',
  '     amountCents (positive=credit/deposit, negative=debit/withdrawal).',
  '  2. candidates[]   — open bookkeeping rows the transaction *could*',
  '     match. Each has id, kind (ar_payment / ap_payment / expense /',
  "     journal_entry), date, label, and amountCents (always the dollar",
  '     value of the row, sign-agnostic — match by absolute value).',
  '',
  'For each transaction, decide the best matching candidate or none.',
  'Return a JSON object with `matches`: an array, one entry per',
  'transaction, in the same order. Each entry has:',
  '',
  '  {',
  '    "transactionIdx": number,        // 0-based index into transactions[]',
  '    "candidateId": string | null,    // candidate id, or null = no match',
  '    "candidateKind": string | null,  // ar_payment / ap_payment / etc.',
  '    "confidence": "HIGH" | "MEDIUM" | "LOW" | "NONE",',
  '    "reasoning": string              // ≤140 chars, plain English',
  '  }',
  '',
  'How to decide confidence:',
  '  HIGH   — exact-amount + same-side (credit↔ar_payment, debit↔ap_payment),',
  '            and the date is within ±3 days of the candidate date.',
  '  MEDIUM — exact amount but the description / label disagree, OR',
  '            same-side and within ±10 days but description hints',
  '            at a different counterparty.',
  '  LOW    — partial-amount (off by ≤2%) OR matching counterparty in',
  '            description but amount differs by >2%.',
  '  NONE   — no plausible candidate. Return candidateId=null.',
  '',
  'Be conservative. The bookkeeper reviews every HIGH match in one',
  'click and reviews MEDIUM/LOW manually. False HIGH matches cost more',
  'than missed matches. When in doubt, downgrade.',
].join('\n');

export interface BankRecMatchInputCandidate {
  id: string;
  kind: 'ar_payment' | 'ap_payment' | 'expense' | 'journal_entry';
  date: string;
  label: string;
  amountCents: number;
}

export interface BankRecMatchInputTransaction {
  date: string;
  description: string;
  amountCents: number;
}

export interface BankRecMatchOutputEntry {
  transactionIdx: number;
  candidateId: string | null;
  candidateKind:
    | 'ar_payment'
    | 'ap_payment'
    | 'expense'
    | 'journal_entry'
    | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasoning: string;
}

export interface BankRecMatchOutput {
  matches: BankRecMatchOutputEntry[];
  promptVersion: string;
}
