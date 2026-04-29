import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { LienWaiver } from './lien-waiver';
import type { Pco } from './pco';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

import { buildPortfolioDocumentMonthly } from './portfolio-document-monthly';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'Test',
    status: 'SENT',
    priority: 'MEDIUM',
    sentAt: '2026-04-15',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sb-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    submittalNumber: '1',
    subject: 'Test',
    kind: 'PRODUCT_DATA',
    status: 'SUBMITTED',
    submittedAt: '2026-04-16',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'p-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    pcoNumber: '1',
    title: 'T',
    description: 'T',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-17',
    costImpactCents: 0,
    scheduleImpactDays: 0,
    ...over,
  } as Pco;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 'T',
    description: 'T',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-18',
    lineItems: [],
    ...over,
  } as ChangeOrder;
}

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'X',
    jobName: 'X',
    claimantName: 'YGE',
    paymentAmountCents: 0,
    throughDate: '2026-04-19',
    ...over,
  } as LienWaiver;
}

describe('buildPortfolioDocumentMonthly', () => {
  it('counts every document type per month', () => {
    const r = buildPortfolioDocumentMonthly({
      rfis: [rfi({})],
      submittals: [sub({})],
      pcos: [pco({})],
      changeOrders: [co({})],
      lienWaivers: [lw({})],
    });
    expect(r.rows[0]?.rfis).toBe(1);
    expect(r.rows[0]?.submittals).toBe(1);
    expect(r.rows[0]?.pcos).toBe(1);
    expect(r.rows[0]?.changeOrders).toBe(1);
    expect(r.rows[0]?.lienWaivers).toBe(1);
    expect(r.rows[0]?.total).toBe(5);
  });

  it('skips RFIs / submittals / COs without their date', () => {
    const r = buildPortfolioDocumentMonthly({
      rfis: [rfi({ sentAt: undefined })],
      submittals: [sub({ submittedAt: undefined })],
      pcos: [],
      changeOrders: [co({ proposedAt: undefined })],
      lienWaivers: [],
    });
    expect(r.rollup.totalDocuments).toBe(0);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioDocumentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      rfis: [
        rfi({ id: 'old', sentAt: '2026-03-15' }),
        rfi({ id: 'in', sentAt: '2026-04-15' }),
      ],
      submittals: [],
      pcos: [],
      changeOrders: [],
      lienWaivers: [],
    });
    expect(r.rollup.totalRfis).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioDocumentMonthly({
      rfis: [
        rfi({ id: 'a', sentAt: '2026-06-15' }),
        rfi({ id: 'b', sentAt: '2026-04-15' }),
      ],
      submittals: [],
      pcos: [],
      changeOrders: [],
      lienWaivers: [],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioDocumentMonthly({
      rfis: [],
      submittals: [],
      pcos: [],
      changeOrders: [],
      lienWaivers: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalDocuments).toBe(0);
  });
});
