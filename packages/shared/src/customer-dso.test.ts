import { describe, expect, it } from 'vitest';
import { buildCustomerDsoReport } from './customer-dso';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 100_000_00,
    totalCents: 100_000_00,
    paidCents: 100_000_00,
    status: 'PAID',
  } as ArInvoice;
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'pay-1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'job-1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-05-01',
    amountCents: 100_000_00,
    ...over,
  } as ArPayment;
}

describe('buildCustomerDsoReport', () => {
  it('computes DSO from invoiceDate to latest payment', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [ar({ id: 'ar-1', invoiceDate: '2026-04-01' })],
      arPayments: [pay({ arInvoiceId: 'ar-1', receivedOn: '2026-05-01' })],
    });
    expect(r.rows[0]?.meanDsoDays).toBe(30);
    expect(r.rows[0]?.weightedDsoDays).toBe(30);
  });

  it('skips invoices with no payment on file', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [ar({ id: 'ar-1' })],
      arPayments: [],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips DRAFT and WRITTEN_OFF', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', status: 'DRAFT' }),
        ar({ id: '2', status: 'WRITTEN_OFF' }),
        ar({ id: '3', status: 'PAID' }),
      ],
      arPayments: [
        pay({ arInvoiceId: '3', receivedOn: '2026-05-01' }),
      ],
    });
    expect(r.totalInvoicesConsidered).toBe(1);
  });

  it('uses LATEST payment date when multiple payments cover one invoice', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [ar({ id: 'ar-1', invoiceDate: '2026-04-01' })],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'ar-1', receivedOn: '2026-04-15' }),
        pay({ id: 'p2', arInvoiceId: 'ar-1', receivedOn: '2026-05-15' }),
      ],
    });
    // 2026-04-01 → 2026-05-15 = 44 days
    expect(r.rows[0]?.maxDsoDays).toBe(44);
  });

  it('weighted DSO favors larger invoices', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: 'small', invoiceDate: '2026-04-01', totalCents: 1_000_00, customerName: 'A' }),
        ar({ id: 'big', invoiceDate: '2026-04-01', totalCents: 100_000_00, customerName: 'A' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'small', receivedOn: '2026-04-15' }), // 14 days
        pay({ id: 'p2', arInvoiceId: 'big', receivedOn: '2026-05-15' }),   // 44 days
      ],
    });
    // Mean = (14 + 44) / 2 = 29
    expect(r.rows[0]?.meanDsoDays).toBe(29);
    // Weighted = (14*1000 + 44*100000) / 101000 ≈ 43.7
    expect(r.rows[0]?.weightedDsoDays).toBe(44);
  });

  it('sorts slowest payers first', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: 'fast', customerName: 'Fast', invoiceDate: '2026-04-01' }),
        ar({ id: 'slow', customerName: 'Slow', invoiceDate: '2026-04-01' }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: 'fast', receivedOn: '2026-04-10' }),
        pay({ id: 'p2', arInvoiceId: 'slow', receivedOn: '2026-06-30' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Slow');
  });

  it('blendedDsoDays = portfolio-wide weighted average', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', customerName: 'A', invoiceDate: '2026-04-01', totalCents: 100_00 }),
        ar({ id: '2', customerName: 'B', invoiceDate: '2026-04-01', totalCents: 100_00 }),
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: '1', receivedOn: '2026-04-11' }), // 10 days
        pay({ id: 'p2', arInvoiceId: '2', receivedOn: '2026-04-21' }), // 20 days
      ],
    });
    expect(r.blendedDsoDays).toBe(15);
  });

  it('honors date range on invoiceDate', () => {
    const r = buildCustomerDsoReport({
      start: '2026-04-01',
      end: '2026-04-30',
      arInvoices: [
        ar({ id: '1', invoiceDate: '2026-03-15' }), // out of window
        ar({ id: '2', invoiceDate: '2026-04-15' }), // in
      ],
      arPayments: [
        pay({ id: 'p1', arInvoiceId: '1', receivedOn: '2026-04-15' }),
        pay({ id: 'p2', arInvoiceId: '2', receivedOn: '2026-05-01' }),
      ],
    });
    expect(r.totalInvoicesConsidered).toBe(1);
  });
});
