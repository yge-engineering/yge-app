import { describe, it, expect } from 'vitest';
import {
  BankTransactionSchema,
  bankTransactionsFromOfx,
  findDuplicateCharges,
  findFeeIncreases,
  findLargeRoundChecks,
  findNewVendorLarge,
  findUnusualAmounts,
  findWeekendLargeDebits,
  scanForAnomalies,
  type BankTransaction,
} from './bank-anomaly';
import type { OfxTransaction } from './ofx-parser';

function txn(over: Partial<BankTransaction>): BankTransaction {
  return BankTransactionSchema.parse({
    id: 't',
    postedOn: '2026-05-01',
    merchant: 'Acme Hardware',
    amountCents: 100_00,
    type: 'DEBIT',
    ...over,
  });
}

describe('findDuplicateCharges', () => {
  it('flags same vendor + amount within window', () => {
    const r = findDuplicateCharges([
      txn({ id: 'a', postedOn: '2026-05-01' }),
      txn({ id: 'b', postedOn: '2026-05-02' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.code).toBe('DUPLICATE_CHARGE');
    expect(r[0]!.transactionIds).toEqual(['a', 'b']);
  });

  it('does not flag outside the 3-day window', () => {
    const r = findDuplicateCharges([
      txn({ id: 'a', postedOn: '2026-05-01' }),
      txn({ id: 'b', postedOn: '2026-05-10' }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('does not flag different amounts', () => {
    const r = findDuplicateCharges([
      txn({ id: 'a', amountCents: 100_00 }),
      txn({ id: 'b', amountCents: 101_00 }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('is case-insensitive on merchant name', () => {
    const r = findDuplicateCharges([
      txn({ id: 'a', merchant: 'Acme Hardware' }),
      txn({ id: 'b', merchant: 'ACME HARDWARE' }),
    ]);
    expect(r).toHaveLength(1);
  });

  it('ignores credits', () => {
    const r = findDuplicateCharges([
      txn({ id: 'a', type: 'CREDIT' }),
      txn({ id: 'b', type: 'CREDIT' }),
    ]);
    expect(r).toHaveLength(0);
  });
});

describe('findFeeIncreases', () => {
  it('flags rising recurring fee', () => {
    const r = findFeeIncreases([
      txn({ id: 'a', merchant: 'Monthly Maintenance Fee', amountCents: 5_00, postedOn: '2026-03-01' }),
      txn({ id: 'b', merchant: 'Monthly Maintenance Fee', amountCents: 7_50, postedOn: '2026-04-01' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.code).toBe('FEE_INCREASE');
  });

  it('does not flag a steady or decreasing fee', () => {
    const r = findFeeIncreases([
      txn({ id: 'a', merchant: 'Monthly Maintenance Fee', amountCents: 5_00, postedOn: '2026-03-01' }),
      txn({ id: 'b', merchant: 'Monthly Maintenance Fee', amountCents: 5_00, postedOn: '2026-04-01' }),
      txn({ id: 'c', merchant: 'Monthly Maintenance Fee', amountCents: 3_00, postedOn: '2026-05-01' }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('only considers fee-like merchants', () => {
    const r = findFeeIncreases([
      txn({ id: 'a', merchant: 'Acme Hardware', amountCents: 100_00, postedOn: '2026-03-01' }),
      txn({ id: 'b', merchant: 'Acme Hardware', amountCents: 200_00, postedOn: '2026-04-01' }),
    ]);
    expect(r).toHaveLength(0);
  });
});

describe('findUnusualAmounts', () => {
  it('flags a debit > 3σ above the merchant mean', () => {
    const history = [50_00, 55_00, 52_00, 48_00, 51_00].map((c, i) =>
      txn({
        id: `h${i}`,
        merchant: 'Office Supplies',
        amountCents: c,
        postedOn: `2026-03-${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const spike = txn({
      id: 'spike',
      merchant: 'Office Supplies',
      amountCents: 500_00,
      postedOn: '2026-04-01',
    });
    const r = findUnusualAmounts([...history, spike]);
    expect(r.map((a) => a.transactionIds[0])).toContain('spike');
  });

  it('needs at least the minimum history before flagging', () => {
    const r = findUnusualAmounts([
      txn({ id: 'a', amountCents: 50_00, postedOn: '2026-03-01' }),
      txn({ id: 'b', amountCents: 5_000_00, postedOn: '2026-03-02' }),
    ]);
    expect(r).toHaveLength(0);
  });
});

describe('findLargeRoundChecks', () => {
  it('flags exact-thousand debit at or above $5k', () => {
    const r = findLargeRoundChecks([
      txn({ id: 'a', amountCents: 5_000_00 }),
      txn({ id: 'b', amountCents: 10_000_00 }),
    ]);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.code === 'LARGE_ROUND_CHECK')).toBe(true);
  });

  it('does not flag below threshold or non-round', () => {
    const r = findLargeRoundChecks([
      txn({ id: 'a', amountCents: 4_999_00 }),
      txn({ id: 'b', amountCents: 5_137_42 }),
    ]);
    expect(r).toHaveLength(0);
  });
});

describe('findNewVendorLarge', () => {
  it('flags debits to unknown merchants over $2.5k', () => {
    const r = findNewVendorLarge(
      [
        txn({ id: 'a', merchant: 'Mystery LLC', amountCents: 3_000_00 }),
        txn({ id: 'b', merchant: 'Known Vendor', amountCents: 3_000_00 }),
      ],
      ['Known Vendor'],
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.transactionIds).toEqual(['a']);
  });

  it('is case-insensitive on the known-merchant list', () => {
    const r = findNewVendorLarge(
      [txn({ id: 'a', merchant: 'KNOWN VENDOR', amountCents: 3_000_00 })],
      ['known vendor'],
    );
    expect(r).toHaveLength(0);
  });
});

describe('findWeekendLargeDebits', () => {
  it('flags large debit posted on Saturday', () => {
    // 2026-05-02 is a Saturday.
    const r = findWeekendLargeDebits([
      txn({ id: 'a', postedOn: '2026-05-02', amountCents: 8_000_00 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.severity).toBe('critical');
  });

  it('does not flag weekday large debit', () => {
    // 2026-05-04 is a Monday.
    const r = findWeekendLargeDebits([
      txn({ id: 'a', postedOn: '2026-05-04', amountCents: 8_000_00 }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('does not flag a weekend debit below threshold', () => {
    const r = findWeekendLargeDebits([
      txn({ id: 'a', postedOn: '2026-05-02', amountCents: 100_00 }),
    ]);
    expect(r).toHaveLength(0);
  });
});

describe('scanForAnomalies (integration)', () => {
  it('returns flags from every applicable rule', () => {
    const dupA = txn({ id: 'd1', postedOn: '2026-05-01', amountCents: 250_00 });
    const dupB = txn({ id: 'd2', postedOn: '2026-05-02', amountCents: 250_00 });
    const round = txn({
      id: 'r1',
      merchant: 'Cashiers Check',
      postedOn: '2026-05-04',
      amountCents: 10_000_00,
    });
    const flags = scanForAnomalies([dupA, dupB, round], {
      asOfDate: '2026-05-22',
      knownMerchants: ['Acme Hardware'],
    });
    const codes = new Set(flags.map((f) => f.code));
    expect(codes).toContain('DUPLICATE_CHARGE');
    expect(codes).toContain('LARGE_ROUND_CHECK');
    // Cashiers Check is unknown + $10k → also new vendor large.
    expect(codes).toContain('NEW_VENDOR_LARGE');
  });

  it('skips NEW_VENDOR_LARGE when knownMerchants is omitted', () => {
    const t = txn({ id: 't1', merchant: 'Mystery LLC', amountCents: 10_000_00 });
    const flags = scanForAnomalies([t], { asOfDate: '2026-05-22' });
    const codes = new Set(flags.map((f) => f.code));
    expect(codes.has('NEW_VENDOR_LARGE')).toBe(false);
  });
});

describe('bankTransactionsFromOfx', () => {
  it('flips sign convention — negative OFX cents become DEBIT positives', () => {
    const ofx: OfxTransaction[] = [
      {
        date: '2026-05-01',
        description: 'Acme Hardware',
        amountCents: -157_42,
        fitId: 'FIT-A',
        trnType: 'DEBIT',
      },
      {
        date: '2026-05-02',
        description: 'Customer ACH',
        amountCents: 5_000_00,
        fitId: 'FIT-B',
        trnType: 'CREDIT',
      },
    ];
    const r = bankTransactionsFromOfx(ofx);
    expect(r[0]).toEqual({
      id: 'FIT-A',
      postedOn: '2026-05-01',
      merchant: 'Acme Hardware',
      amountCents: 157_42,
      type: 'DEBIT',
    });
    expect(r[1]).toEqual({
      id: 'FIT-B',
      postedOn: '2026-05-02',
      merchant: 'Customer ACH',
      amountCents: 5_000_00,
      type: 'CREDIT',
    });
  });

  it('falls back to ofx-<idx> when FITID is null', () => {
    const ofx: OfxTransaction[] = [
      {
        date: '2026-05-01',
        description: 'Vendor X',
        amountCents: -100_00,
        fitId: null,
        trnType: null,
      },
    ];
    const r = bankTransactionsFromOfx(ofx);
    expect(r[0]!.id).toBe('ofx-0');
  });

  it('substitutes "(no description)" when OFX description is empty', () => {
    const ofx: OfxTransaction[] = [
      {
        date: '2026-05-01',
        description: '   ',
        amountCents: -100_00,
        fitId: 'F1',
        trnType: null,
      },
    ];
    const r = bankTransactionsFromOfx(ofx);
    expect(r[0]!.merchant).toBe('(no description)');
  });

  it('feeds straight into scanForAnomalies', () => {
    const ofx: OfxTransaction[] = [
      // Duplicate within window.
      { date: '2026-05-01', description: 'Vendor X', amountCents: -250_00, fitId: 'F1', trnType: null },
      { date: '2026-05-02', description: 'Vendor X', amountCents: -250_00, fitId: 'F2', trnType: null },
    ];
    const txns = bankTransactionsFromOfx(ofx);
    const flags = scanForAnomalies(txns, { asOfDate: '2026-05-22' });
    expect(flags.some((f) => f.code === 'DUPLICATE_CHARGE')).toBe(true);
  });
});
