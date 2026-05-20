import { describe, expect, it } from 'vitest';
import { buildAccountLedger } from './account-ledger';
import type { JournalEntry } from './journal-entry';

function je(over: Partial<JournalEntry> & { id: string; entryDate: string; lines: JournalEntry['lines'] }): JournalEntry {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    memo: 'memo',
    source: 'OTHER',
    status: 'POSTED',
    ...over,
  } as JournalEntry;
}

const ENTRIES: JournalEntry[] = [
  je({ id: 'je-1', entryDate: '2026-01-10', memo: 'Opening', lines: [
    { accountNumber: '10000', debitCents: 100000, creditCents: 0 },
    { accountNumber: '32000', debitCents: 0, creditCents: 100000 },
  ] }),
  je({ id: 'je-2', entryDate: '2026-02-15', memo: 'Deposit', lines: [
    { accountNumber: '10000', debitCents: 50000, creditCents: 0, memo: 'check' },
    { accountNumber: '40000', debitCents: 0, creditCents: 50000 },
  ] }),
  je({ id: 'je-3', entryDate: '2026-03-20', memo: 'Payment', lines: [
    { accountNumber: '10000', debitCents: 0, creditCents: 30000 },
    { accountNumber: '60000', debitCents: 30000, creditCents: 0 },
  ] }),
  je({ id: 'je-draft', entryDate: '2026-02-01', memo: 'Draft', status: 'DRAFT', lines: [
    { accountNumber: '10000', debitCents: 999999, creditCents: 0 },
    { accountNumber: '40000', debitCents: 0, creditCents: 999999 },
  ] }),
];

describe('buildAccountLedger', () => {
  it('returns posted lines for the account in date order with a running balance', () => {
    const led = buildAccountLedger(ENTRIES, '10000');
    expect(led.lines.map((l) => l.entryId)).toEqual(['je-1', 'je-2', 'je-3']);
    expect(led.lines.map((l) => l.runningBalanceCents)).toEqual([100000, 150000, 120000]);
    expect(led.endingBalanceCents).toBe(120000);
    expect(led.totalDebitCents).toBe(150000);
    expect(led.totalCreditCents).toBe(30000);
  });

  it('ignores draft / non-posted entries', () => {
    const led = buildAccountLedger(ENTRIES, '10000');
    expect(led.lines.some((l) => l.entryId === 'je-draft')).toBe(false);
  });

  it('carries pre-window activity into the opening balance', () => {
    const led = buildAccountLedger(ENTRIES, '10000', { periodStart: '2026-02-01' });
    // je-1 (Jan 10) is before the window -> opening balance 100000.
    expect(led.openingBalanceCents).toBe(100000);
    expect(led.lines.map((l) => l.entryId)).toEqual(['je-2', 'je-3']);
    // running starts from opening: 100000 + 50000 = 150000, then -30000 = 120000.
    expect(led.lines.map((l) => l.runningBalanceCents)).toEqual([150000, 120000]);
    expect(led.endingBalanceCents).toBe(120000);
  });

  it('excludes lines after periodEnd', () => {
    const led = buildAccountLedger(ENTRIES, '10000', { periodEnd: '2026-02-28' });
    expect(led.lines.map((l) => l.entryId)).toEqual(['je-1', 'je-2']);
  });

  it('captures the per-line memo when present', () => {
    const led = buildAccountLedger(ENTRIES, '10000');
    const dep = led.lines.find((l) => l.entryId === 'je-2');
    expect(dep!.lineMemo).toBe('check');
  });

  it('returns an empty ledger for an account with no activity', () => {
    const led = buildAccountLedger(ENTRIES, '99999');
    expect(led.lines).toHaveLength(0);
    expect(led.endingBalanceCents).toBe(0);
  });
});
