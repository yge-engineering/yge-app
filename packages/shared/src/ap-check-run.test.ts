import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildApCheckRun } from './ap-check-run';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply LLC',
    invoiceDate: '2026-04-01',
    dueDate: '2026-05-01',
    lineItems: [],
    totalCents: 1_000_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Supply LLC',
    kind: 'SUPPLIER',
    w9OnFile: false,
    is1099Reportable: false,
    coiOnFile: false,
    paymentTerms: 'NET_30',
    onHold: false,
    ...over,
  } as Vendor;
}

describe('buildApCheckRun', () => {
  it('only includes APPROVED invoices with unpaid balance', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'ap-1', status: 'APPROVED' }),
        ap({ id: 'ap-2', status: 'PENDING' }),
        ap({ id: 'ap-3', status: 'PAID' }),
        ap({ id: 'ap-4', status: 'APPROVED', totalCents: 100_00, paidCents: 100_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceId).toBe('ap-1');
  });

  it('flags OVERDUE when due date has passed', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [ap({ dueDate: '2026-04-15' })],
    });
    expect(r.rows[0]?.urgency).toBe('OVERDUE');
    expect(r.rollup.overdueCount).toBe(1);
  });

  it('flags DUE_SOON for invoices due within 7 days', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [ap({ dueDate: '2026-04-30' })],
    });
    expect(r.rows[0]?.urgency).toBe('DUE_SOON');
    expect(r.rollup.dueSoonCount).toBe(1);
  });

  it('flags DUE_LATER for invoices due more than 7 days out', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [ap({ dueDate: '2026-06-30' })],
    });
    expect(r.rows[0]?.urgency).toBe('DUE_LATER');
  });

  it('flags NO_DATE when no dueDate set', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [ap({ dueDate: undefined })],
    });
    expect(r.rows[0]?.urgency).toBe('NO_DATE');
  });

  it('attaches vendor on-hold flag from vendor master', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [ap({})],
      vendors: [vendor({ onHold: true })],
    });
    expect(r.rows[0]?.vendorOnHold).toBe(true);
    expect(r.byVendor[0]?.vendorOnHold).toBe(true);
  });

  it('rolls up min cash (OVERDUE only) and recommended (OVERDUE + DUE_SOON)', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'ap-overdue', dueDate: '2026-04-15', totalCents: 5_000_00 }),
        ap({ id: 'ap-soon', dueDate: '2026-04-30', totalCents: 3_000_00 }),
        ap({ id: 'ap-later', dueDate: '2026-06-30', totalCents: 99_000_00 }),
      ],
    });
    expect(r.rollup.minCashNeededCents).toBe(5_000_00);
    expect(r.rollup.recommendedCashCents).toBe(8_000_00);
  });

  it('rolls up byVendor with one row per vendor', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Acme', dueDate: '2026-04-15', totalCents: 100_00 }),
        ap({ id: 'ap-2', vendorName: 'Acme', dueDate: '2026-04-30', totalCents: 200_00 }),
        ap({ id: 'ap-3', vendorName: 'Beta', dueDate: '2026-04-30', totalCents: 300_00 }),
      ],
    });
    expect(r.byVendor).toHaveLength(2);
    const acme = r.byVendor.find((v) => v.vendorName === 'Acme');
    expect(acme?.invoiceCount).toBe(2);
    expect(acme?.unpaidTotalCents).toBe(300_00);
    expect(acme?.hasOverdue).toBe(true);
  });

  it('sorts vendors with OVERDUE first', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'ap-big-soon', vendorName: 'BigSoon', dueDate: '2026-04-30', totalCents: 50_000_00 }),
        ap({ id: 'ap-small-od', vendorName: 'SmallOd', dueDate: '2026-04-15', totalCents: 100_00 }),
      ],
    });
    expect(r.byVendor[0]?.vendorName).toBe('SmallOd');
  });

  it('sorts rows OVERDUE first, then by daysToDue asc', () => {
    const r = buildApCheckRun({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'ap-future', dueDate: '2026-12-31' }),
        ap({ id: 'ap-overdue-old', dueDate: '2026-03-01' }),
        ap({ id: 'ap-overdue-new', dueDate: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.invoiceId).toBe('ap-overdue-old');
    expect(r.rows[1]?.invoiceId).toBe('ap-overdue-new');
    expect(r.rows[2]?.invoiceId).toBe('ap-future');
  });
});
