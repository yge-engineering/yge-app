import { describe, expect, it } from 'vitest';
import { buildWipRow, computeWipRollup } from './wip';
import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { ChangeOrder } from './change-order';
import type { Job } from './job';

function job(over: Partial<Job>): Job {
  return {
    id: 'job-2026-01-01-test-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    projectName: 'Sulphur Springs',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'AWARDED',
    ...over,
  };
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    source: 'MANUAL',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 0,
    paidCents: 0,
    status: 'SENT',
    ...over,
  };
}

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    arInvoiceId: 'ar-aaaaaaaa',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 0,
    ...over,
  };
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    vendorName: 'Acme Concrete',
    invoiceNumber: 'INV-1',
    invoiceDate: '2026-04-01',
    totalCents: 0,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    changeOrderNumber: '1',
    subject: 'Extra base rock',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'EXECUTED',
    lineItems: [],
    totalCostImpactCents: 0,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildWipRow', () => {
  it('flags an over-billed job (billed > earned)', () => {
    const r = buildWipRow({
      job: job({}),
      originalContractCents: 100_000_00,
      estimatedCostAtCompletionCents: 80_000_00,
      arInvoices: [ar({ totalCents: 60_000_00 })],
      arPayments: [],
      apInvoices: [ap({ totalCents: 40_000_00 })], // 50% complete
      changeOrders: [],
    });
    // earned = $100,000 * 50% = $50,000
    // over = $60,000 - $50,000 = $10,000
    expect(r.percentComplete).toBeCloseTo(0.5, 5);
    expect(r.earnedRevenueCents).toBe(50_000_00);
    expect(r.overBilledCents).toBe(10_000_00);
    expect(r.underBilledCents).toBe(0);
  });

  it('flags an under-billed job (earned > billed)', () => {
    const r = buildWipRow({
      job: job({}),
      originalContractCents: 100_000_00,
      estimatedCostAtCompletionCents: 80_000_00,
      arInvoices: [ar({ totalCents: 30_000_00 })],
      arPayments: [],
      apInvoices: [ap({ totalCents: 60_000_00 })], // 75% complete
      changeOrders: [],
    });
    // earned = $100,000 * 75% = $75,000
    // under = $75,000 - $30,000 = $45,000
    expect(r.percentComplete).toBeCloseTo(0.75, 5);
    expect(r.earnedRevenueCents).toBe(75_000_00);
    expect(r.underBilledCents).toBe(45_000_00);
    expect(r.overBilledCents).toBe(0);
  });

  it('only counts approved + executed change orders in adjusted contract', () => {
    const r = buildWipRow({
      job: job({}),
      originalContractCents: 100_000_00,
      estimatedCostAtCompletionCents: 80_000_00,
      arInvoices: [],
      arPayments: [],
      apInvoices: [],
      changeOrders: [
        co({ id: 'co-aaaaaaa1', totalCostImpactCents:5_000_00, status: 'APPROVED' }),
        co({ id: 'co-aaaaaaa2', totalCostImpactCents:7_500_00, status: 'EXECUTED' }),
        co({ id: 'co-aaaaaaa3', totalCostImpactCents:99_999_00, status: 'PROPOSED' }),
        co({ id: 'co-aaaaaaa4', totalCostImpactCents:50_000_00, status: 'REJECTED' }),
      ],
    });
    expect(r.changeOrderTotalCents).toBe(12_500_00);
    expect(r.adjustedContractCents).toBe(112_500_00);
  });

  it('skips draft / pending / rejected AP invoices in cost-to-date', () => {
    const r = buildWipRow({
      job: job({}),
      originalContractCents: 100_000_00,
      estimatedCostAtCompletionCents: 80_000_00,
      arInvoices: [],
      arPayments: [],
      apInvoices: [
        ap({ id: 'api-aaaaaaa1', totalCents: 10_000_00, status: 'APPROVED' }),
        ap({ id: 'api-aaaaaaa2', totalCents: 20_000_00, status: 'PAID' }),
        ap({ id: 'api-aaaaaaa3', totalCents: 50_000_00, status: 'DRAFT' }),
        ap({ id: 'api-aaaaaaa4', totalCents: 50_000_00, status: 'PENDING' }),
        ap({ id: 'api-aaaaaaa5', totalCents: 99_999_00, status: 'REJECTED' }),
      ],
      changeOrders: [],
    });
    expect(r.costsIncurredCents).toBe(30_000_00);
  });

  it('subtracts retention release payments from retention held', () => {
    const r = buildWipRow({
      job: job({}),
      originalContractCents: 100_000_00,
      estimatedCostAtCompletionCents: 80_000_00,
      arInvoices: [
        ar({ id: 'ar-aaaaaaa1', totalCents: 50_000_00, retentionCents: 5_000_00 }),
        ar({ id: 'ar-aaaaaaa2', totalCents: 50_000_00, retentionCents: 5_000_00 }),
      ],
      arPayments: [
        arp({ id: 'arp-aaaaaaa1', kind: 'PROGRESS', amountCents: 80_000_00 }),
        arp({ id: 'arp-aaaaaaa2', kind: 'RETENTION_RELEASE', amountCents: 4_000_00 }),
      ],
      apInvoices: [],
      changeOrders: [],
    });
    expect(r.retentionHeldCents).toBe(6_000_00);
  });
});

describe('computeWipRollup', () => {
  it('sums across jobs', () => {
    const a = buildWipRow({
      job: job({ id: 'job-2026-01-01-a-aaaaaaaa' }),
      originalContractCents: 100_000_00,
      estimatedCostAtCompletionCents: 80_000_00,
      arInvoices: [ar({ totalCents: 60_000_00 })],
      arPayments: [],
      apInvoices: [ap({ totalCents: 40_000_00 })],
      changeOrders: [],
    });
    const b = buildWipRow({
      job: job({ id: 'job-2026-01-01-b-bbbbbbbb' }),
      originalContractCents: 50_000_00,
      estimatedCostAtCompletionCents: 40_000_00,
      arInvoices: [ar({ totalCents: 10_000_00 })],
      arPayments: [],
      apInvoices: [ap({ totalCents: 30_000_00 })],
      changeOrders: [],
    });
    const r = computeWipRollup([a, b]);
    expect(r.jobs).toBe(2);
    expect(r.totalAdjustedContractCents).toBe(150_000_00);
    expect(r.totalBilledCents).toBe(70_000_00);
    expect(r.totalCostsIncurredCents).toBe(70_000_00);
  });
});
