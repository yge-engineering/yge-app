import { describe, expect, it } from 'vitest';
import { buildCashPositionReport } from './cash-position';
import type { ApPayment } from './ap-payment';
import type { ArPayment } from './ar-payment';

function arPay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 10_000_00,
    ...over,
  } as ArPayment;
}

function apPay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'api-1',
    paidOn: '2026-04-15',
    amountCents: 5_000_00,
    method: 'CHECK',
    ...over,
  } as ApPayment;
}

describe('buildCashPositionReport', () => {
  it('walks every day in the window densely', () => {
    const r = buildCashPositionReport({
      start: '2026-04-13',
      end: '2026-04-17',
      openingBalanceCents: 0,
      arPayments: [],
      apPayments: [],
    });
    expect(r.days).toHaveLength(5);
    expect(r.days.map((d) => d.date)).toEqual([
      '2026-04-13',
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
      '2026-04-17',
    ]);
  });

  it('totals AR in and AP out', () => {
    const r = buildCashPositionReport({
      start: '2026-04-13',
      end: '2026-04-17',
      openingBalanceCents: 100_000_00,
      arPayments: [
        arPay({ receivedOn: '2026-04-13', amountCents: 50_000_00 }),
        arPay({ receivedOn: '2026-04-15', amountCents: 20_000_00 }),
      ],
      apPayments: [
        apPay({ paidOn: '2026-04-14', amountCents: 30_000_00 }),
      ],
    });
    expect(r.totalArInCents).toBe(70_000_00);
    expect(r.totalApOutCents).toBe(30_000_00);
    expect(r.netCents).toBe(40_000_00);
    expect(r.closingBalanceCents).toBe(140_000_00);
  });

  it('running balance accumulates day by day', () => {
    const r = buildCashPositionReport({
      start: '2026-04-13',
      end: '2026-04-17',
      openingBalanceCents: 0,
      arPayments: [
        arPay({ receivedOn: '2026-04-14', amountCents: 100_00 }),
      ],
      apPayments: [
        apPay({ paidOn: '2026-04-16', amountCents: 50_00 }),
      ],
    });
    expect(r.days[0]?.runningBalanceCents).toBe(0);   // 04-13
    expect(r.days[1]?.runningBalanceCents).toBe(100_00); // 04-14
    expect(r.days[2]?.runningBalanceCents).toBe(100_00); // 04-15
    expect(r.days[3]?.runningBalanceCents).toBe(50_00);  // 04-16
    expect(r.days[4]?.runningBalanceCents).toBe(50_00);  // 04-17
  });

  it('worstDay = largest negative net', () => {
    const r = buildCashPositionReport({
      start: '2026-04-13',
      end: '2026-04-17',
      openingBalanceCents: 0,
      arPayments: [],
      apPayments: [
        apPay({ paidOn: '2026-04-14', amountCents: 5_000_00 }),
        apPay({ paidOn: '2026-04-16', amountCents: 50_000_00 }),
      ],
    });
    expect(r.worstDay?.date).toBe('2026-04-16');
    expect(r.worstDay?.netCents).toBe(-50_000_00);
  });

  it('bestDay = largest positive net', () => {
    const r = buildCashPositionReport({
      start: '2026-04-13',
      end: '2026-04-17',
      openingBalanceCents: 0,
      arPayments: [
        arPay({ receivedOn: '2026-04-15', amountCents: 100_000_00 }),
      ],
      apPayments: [],
    });
    expect(r.bestDay?.date).toBe('2026-04-15');
    expect(r.bestDay?.netCents).toBe(100_000_00);
  });

  it('skips payments outside the window', () => {
    const r = buildCashPositionReport({
      start: '2026-04-13',
      end: '2026-04-17',
      openingBalanceCents: 0,
      arPayments: [
        arPay({ receivedOn: '2026-04-01', amountCents: 99_999_00 }),
      ],
      apPayments: [
        apPay({ paidOn: '2026-04-30', amountCents: 99_999_00 }),
      ],
    });
    expect(r.totalArInCents).toBe(0);
    expect(r.totalApOutCents).toBe(0);
  });

  it('inverted range returns empty days', () => {
    const r = buildCashPositionReport({
      start: '2026-04-30',
      end: '2026-04-01',
      openingBalanceCents: 100_000_00,
      arPayments: [],
      apPayments: [],
    });
    expect(r.days).toHaveLength(0);
    expect(r.closingBalanceCents).toBe(100_000_00);
  });

  it('multiple payments same day get summed', () => {
    const r = buildCashPositionReport({
      start: '2026-04-15',
      end: '2026-04-15',
      openingBalanceCents: 0,
      arPayments: [
        arPay({ id: '1', receivedOn: '2026-04-15', amountCents: 100_00 }),
        arPay({ id: '2', receivedOn: '2026-04-15', amountCents: 200_00 }),
      ],
      apPayments: [],
    });
    expect(r.days[0]?.arInCents).toBe(300_00);
  });
});
