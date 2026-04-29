import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { LienWaiver } from './lien-waiver';
import type { Pco } from './pco';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

import { buildPortfolioDocumentYoy } from './portfolio-document-yoy';

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
    subject: 'T',
    kind: 'PRODUCT_DATA',
    status: 'SUBMITTED',
    submittedAt: '2026-04-15',
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
    noticedOn: '2026-04-15',
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
    proposedAt: '2026-04-15',
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
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildPortfolioDocumentYoy', () => {
  it('compares prior vs current totals', () => {
    const r = buildPortfolioDocumentYoy({
      currentYear: 2026,
      rfis: [rfi({ id: 'a', sentAt: '2025-04-15' })],
      submittals: [sub({ id: 'b', submittedAt: '2026-04-15' })],
      pcos: [pco({ id: 'c', noticedOn: '2026-04-15' })],
      changeOrders: [co({ id: 'd', proposedAt: '2026-04-15' })],
      lienWaivers: [lw({ id: 'e', throughDate: '2025-04-15' })],
    });
    expect(r.priorTotal).toBe(2);
    expect(r.currentTotal).toBe(3);
    expect(r.totalDelta).toBe(1);
  });

  it('skips items without their date', () => {
    const r = buildPortfolioDocumentYoy({
      currentYear: 2026,
      rfis: [rfi({ id: 'a', sentAt: undefined })],
      submittals: [sub({ id: 'b', submittedAt: undefined })],
      pcos: [],
      changeOrders: [co({ id: 'd', proposedAt: undefined })],
      lienWaivers: [],
    });
    expect(r.currentTotal).toBe(0);
    expect(r.priorTotal).toBe(0);
  });

  it('ignores out-of-window dates', () => {
    const r = buildPortfolioDocumentYoy({
      currentYear: 2026,
      rfis: [
        rfi({ id: 'old', sentAt: '2024-04-15' }),
        rfi({ id: 'in', sentAt: '2026-04-15' }),
      ],
      submittals: [],
      pcos: [],
      changeOrders: [],
      lienWaivers: [],
    });
    expect(r.priorRfis).toBe(0);
    expect(r.currentRfis).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioDocumentYoy({
      currentYear: 2026,
      rfis: [],
      submittals: [],
      pcos: [],
      changeOrders: [],
      lienWaivers: [],
    });
    expect(r.currentTotal).toBe(0);
  });
});
