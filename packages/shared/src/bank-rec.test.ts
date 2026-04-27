import { describe, expect, it } from 'vitest';
import {
  computeBankRec,
  computeBankRecRollup,
  signedAdjustmentNetCents,
  type BankRec,
  type BankRecAdjustment,
} from './bank-rec';

function rec(over: Partial<BankRec> = {}): BankRec {
  return {
    id: 'bnk-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    bankAccountLabel: 'Operating',
    statementDate: '2026-04-30',
    beginningBalanceCents: 0,
    statementBalanceCents: 0,
    glBalanceCents: 0,
    outstandingChecksCents: 0,
    outstandingDepositsCents: 0,
    adjustments: [],
    status: 'DRAFT',
    ...over,
  };
}

describe('computeBankRec', () => {
  it('reconciles when statement and GL match exactly with no adjustments', () => {
    const r = computeBankRec(
      rec({ statementBalanceCents: 100_000_00, glBalanceCents: 100_000_00 }),
    );
    expect(r.inBalance).toBe(true);
    expect(r.imbalanceCents).toBe(0);
  });

  it('reconciles when outstanding checks explain the GL-vs-statement gap', () => {
    // Statement = $100k, GL = $95k, outstanding checks = $5k.
    // Adjusted bank = 100k − 5k = 95k. Adjusted GL = 95k. ✓
    const r = computeBankRec(
      rec({
        statementBalanceCents: 100_000_00,
        glBalanceCents: 95_000_00,
        outstandingChecksCents: 5_000_00,
      }),
    );
    expect(r.inBalance).toBe(true);
    expect(r.adjustedBankBalanceCents).toBe(95_000_00);
    expect(r.adjustedGlBalanceCents).toBe(95_000_00);
  });

  it('reconciles with deposits in transit', () => {
    // Statement = $100k, GL = $105k, deposit in transit = $5k.
    // Adjusted bank = 100k + 5k = 105k. Adjusted GL = 105k. ✓
    const r = computeBankRec(
      rec({
        statementBalanceCents: 100_000_00,
        glBalanceCents: 105_000_00,
        outstandingDepositsCents: 5_000_00,
      }),
    );
    expect(r.inBalance).toBe(true);
  });

  it('reconciles with bank fees subtracted from GL', () => {
    // Statement = $99,950 (post-fee), GL = $100,000.
    // Bank fee = $50. Adjusted GL = 100k − 50 = 99,950. ✓
    const r = computeBankRec(
      rec({
        statementBalanceCents: 99_950_00,
        glBalanceCents: 100_000_00,
        adjustments: [
          { kind: 'BANK_FEE', description: 'Wire fee', amountCents: 50_00 },
        ],
      }),
    );
    expect(r.inBalance).toBe(true);
  });

  it('reconciles with interest income added to GL', () => {
    // Statement = $100,025 (post-interest), GL = $100,000.
    // Interest = $25. Adjusted GL = 100k + 25 = 100,025. ✓
    const r = computeBankRec(
      rec({
        statementBalanceCents: 100_025_00,
        glBalanceCents: 100_000_00,
        adjustments: [
          { kind: 'INTEREST', description: 'April interest', amountCents: 25_00 },
        ],
      }),
    );
    expect(r.inBalance).toBe(true);
  });

  it('does not reconcile when amounts do not match', () => {
    const r = computeBankRec(
      rec({ statementBalanceCents: 100_000_00, glBalanceCents: 99_900_00 }),
    );
    expect(r.inBalance).toBe(false);
    expect(r.imbalanceCents).toBe(100_00);
  });

  it('handles a multi-adjustment real-world scenario', () => {
    // Statement = $84,950
    // GL = $100,000
    //   minus outstanding checks (in transit): $20,000
    //   plus deposits in transit: $5,000
    //   minus bank fee: $50
    //   plus interest: $0
    // Adjusted bank = 84,950 − 20,000 + 5,000 = 69,950
    // Adjusted GL  = 100,000 − 50 + 0 = 99,950 ... not balanced
    //
    // Let's set up so they balance:
    // GL = $30,000
    // Statement = $44,950
    // Outstanding checks = $20,000, deposits in transit = $5,000
    // Bank fee = $50
    // Adjusted bank = 44,950 − 20,000 + 5,000 = 29,950
    // Adjusted GL  = 30,000 − 50 = 29,950 ✓
    const r = computeBankRec(
      rec({
        statementBalanceCents: 44_950_00,
        glBalanceCents: 30_000_00,
        outstandingChecksCents: 20_000_00,
        outstandingDepositsCents: 5_000_00,
        adjustments: [
          { kind: 'BANK_FEE', description: 'April fees', amountCents: 50_00 },
        ],
      }),
    );
    expect(r.inBalance).toBe(true);
    expect(r.adjustedBankBalanceCents).toBe(29_950_00);
    expect(r.adjustedGlBalanceCents).toBe(29_950_00);
  });
});

describe('signedAdjustmentNetCents', () => {
  it('subtracts bank fees, adds interest, sign-respects manual', () => {
    const adj: BankRecAdjustment[] = [
      { kind: 'BANK_FEE', description: 'Wire', amountCents: 50_00 },
      { kind: 'INTEREST', description: 'Apr interest', amountCents: 25_00 },
      { kind: 'MANUAL', description: 'Rounding', amountCents: 1_00 },
    ];
    expect(signedAdjustmentNetCents(adj)).toBe(-50_00 + 25_00 + 1_00);
  });
});

describe('computeBankRecRollup', () => {
  it('counts by status and reports last reconciled date', () => {
    const r = computeBankRecRollup([
      rec({ id: 'bnk-1', status: 'RECONCILED', statementDate: '2026-03-31' }),
      rec({ id: 'bnk-2', status: 'RECONCILED', statementDate: '2026-04-30' }),
      rec({ id: 'bnk-3', status: 'DRAFT', statementDate: '2026-05-31' }),
    ]);
    expect(r.reconciled).toBe(2);
    expect(r.draft).toBe(1);
    expect(r.lastReconciledOn).toBe('2026-04-30');
  });
});
