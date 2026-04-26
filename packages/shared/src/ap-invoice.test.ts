import { describe, expect, it } from 'vitest';
import {
  apDueLevel,
  computeApInvoiceRollup,
  lineItemSumCents,
  unpaidBalanceCents,
  type ApInvoice,
  type ApInvoiceLineItem,
} from './ap-invoice';

const NOW = new Date('2026-04-25T12:00:00Z');

function line(over: Partial<ApInvoiceLineItem> = {}): ApInvoiceLineItem {
  return {
    description: 'Widgets',
    quantity: 1,
    unitPriceCents: 100_00,
    lineTotalCents: 100_00,
    ...over,
  };
}

function inv(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-aaaaaaaa',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 0,
    paidCents: 0,
    status: 'DRAFT',
    ...over,
  };
}

describe('lineItemSumCents', () => {
  it('sums all line totals', () => {
    const i = inv({
      lineItems: [
        line({ lineTotalCents: 100_00 }),
        line({ lineTotalCents: 50_00 }),
        line({ lineTotalCents: 25_00 }),
      ],
    });
    expect(lineItemSumCents(i)).toBe(175_00);
  });
});

describe('unpaidBalanceCents', () => {
  it('returns total minus paid', () => {
    expect(unpaidBalanceCents(inv({ totalCents: 1_000_00, paidCents: 400_00 }))).toBe(600_00);
  });
  it('clamps to 0 on overpaid invoices', () => {
    expect(unpaidBalanceCents(inv({ totalCents: 100_00, paidCents: 200_00 }))).toBe(0);
  });
});

describe('apDueLevel', () => {
  it('returns paid when fully paid', () => {
    expect(
      apDueLevel(inv({ totalCents: 100_00, paidCents: 100_00, status: 'PAID' }), NOW),
    ).toBe('paid');
  });

  it('returns paid when balance is zero even without PAID status', () => {
    expect(
      apDueLevel(inv({ totalCents: 100_00, paidCents: 100_00 }), NOW),
    ).toBe('paid');
  });

  it('returns none when no due date', () => {
    expect(apDueLevel(inv({ totalCents: 100_00 }), NOW)).toBe('none');
  });

  it('returns dueSoon within 7 days', () => {
    expect(
      apDueLevel(inv({ totalCents: 100_00, dueDate: '2026-04-30' }), NOW),
    ).toBe('dueSoon');
  });

  it('returns overdue past the due date', () => {
    expect(
      apDueLevel(inv({ totalCents: 100_00, dueDate: '2026-04-20' }), NOW),
    ).toBe('overdue');
  });

  it('returns ok when comfortably in the future', () => {
    expect(
      apDueLevel(inv({ totalCents: 100_00, dueDate: '2026-06-01' }), NOW),
    ).toBe('ok');
  });
});

describe('computeApInvoiceRollup', () => {
  const fixtures: ApInvoice[] = [
    inv({ status: 'DRAFT', totalCents: 100_00 }),
    inv({ status: 'PENDING', totalCents: 200_00, dueDate: '2026-05-30' }),
    inv({ status: 'APPROVED', totalCents: 300_00, dueDate: '2026-04-20' }), // overdue
    inv({ status: 'APPROVED', totalCents: 400_00, paidCents: 100_00, dueDate: '2026-04-30' }),
    inv({ status: 'PAID', totalCents: 500_00, paidCents: 500_00 }),
    inv({ status: 'REJECTED', totalCents: 50_00 }),
  ];

  it('counts each status bucket', () => {
    const r = computeApInvoiceRollup(fixtures, NOW);
    expect(r.total).toBe(6);
    expect(r.draft).toBe(1);
    expect(r.pending).toBe(1);
    expect(r.approved).toBe(2);
    expect(r.paid).toBe(1);
    expect(r.rejected).toBe(1);
  });

  it('sums outstanding across non-paid + non-rejected', () => {
    const r = computeApInvoiceRollup(fixtures, NOW);
    // 100 + 200 + 300 + 300 (400-100 paid) = 900
    expect(r.outstandingCents).toBe(900_00);
  });

  it('sums overdue subset of outstanding', () => {
    const r = computeApInvoiceRollup(fixtures, NOW);
    // Only the $300 APPROVED with 2026-04-20 due is overdue.
    expect(r.overdueCents).toBe(300_00);
  });
});
