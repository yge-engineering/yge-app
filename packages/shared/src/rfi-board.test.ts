import { describe, expect, it } from 'vitest';
import { buildRfiBoard } from './rfi-board';
import type { Rfi } from './rfi';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    rfiNumber: 'RFI-001',
    subject: 'Question',
    question: '',
    status: 'SENT',
    priority: 'MEDIUM',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildRfiBoard', () => {
  it('hides ANSWERED + CLOSED + WITHDRAWN by default', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [
        rfi({ id: 'a', status: 'ANSWERED' }),
        rfi({ id: 'b', status: 'CLOSED' }),
        rfi({ id: 'c', status: 'WITHDRAWN' }),
        rfi({ id: 'd', status: 'SENT' }),
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['d']);
  });

  it('includeResolved keeps closed RFIs in', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [
        rfi({ id: 'a', status: 'ANSWERED' }),
        rfi({ id: 'b', status: 'SENT' }),
      ],
      includeResolved: true,
    });
    expect(r.rows).toHaveLength(2);
  });

  it('flags DRAFT status as DRAFT urgency', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [rfi({ status: 'DRAFT', responseDueAt: '2026-04-15' })],
    });
    expect(r.rows[0]?.urgency).toBe('DRAFT');
  });

  it('OVERDUE when past responseDueAt', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [rfi({ status: 'SENT', responseDueAt: '2026-04-20' })],
    });
    expect(r.rows[0]?.urgency).toBe('OVERDUE');
  });

  it('CRITICAL when overdue + cost impact', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [rfi({ status: 'SENT', responseDueAt: '2026-04-25', costImpact: true })],
    });
    expect(r.rows[0]?.urgency).toBe('CRITICAL');
  });

  it('CRITICAL when overdue more than 14 days', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [rfi({ status: 'SENT', responseDueAt: '2026-04-01' })],
    });
    expect(r.rows[0]?.urgency).toBe('CRITICAL');
  });

  it('CRITICAL when priority=CRITICAL even if not yet overdue', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [rfi({ status: 'SENT', priority: 'CRITICAL', responseDueAt: '2026-05-15' })],
    });
    expect(r.rows[0]?.urgency).toBe('CRITICAL');
  });

  it('DUE_SOON within 5 days', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [rfi({ status: 'SENT', responseDueAt: '2026-04-30' })],
    });
    expect(r.rows[0]?.urgency).toBe('DUE_SOON');
  });

  it('PENDING when due far out', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [rfi({ status: 'SENT', responseDueAt: '2026-06-15' })],
    });
    expect(r.rows[0]?.urgency).toBe('PENDING');
  });

  it('sorts CRITICAL > OVERDUE > DUE_SOON > PENDING > DRAFT', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [
        rfi({ id: 'p', status: 'SENT', responseDueAt: '2026-06-15' }),
        rfi({ id: 'd', status: 'SENT', responseDueAt: '2026-04-30' }),
        rfi({ id: 'o', status: 'SENT', responseDueAt: '2026-04-20' }),
        rfi({ id: 'c', status: 'SENT', responseDueAt: '2026-04-25', costImpact: true }),
        rfi({ id: 'r', status: 'DRAFT' }),
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['c', 'o', 'd', 'p', 'r']);
  });

  it('rollup tally', () => {
    const r = buildRfiBoard({
      asOf: '2026-04-27',
      rfis: [
        rfi({ id: '1', priority: 'CRITICAL' }),                              // CRITICAL
        rfi({ id: '2', responseDueAt: '2026-04-20' }),                       // OVERDUE
        rfi({ id: '3', responseDueAt: '2026-04-30' }),                       // DUE_SOON
        rfi({ id: '4', responseDueAt: '2026-06-30', costImpact: true }),     // PENDING (with impact)
        rfi({ id: '5', status: 'DRAFT' }),                                   // DRAFT
      ],
    });
    expect(r.rollup.critical).toBe(1);
    expect(r.rollup.overdue).toBe(1);
    expect(r.rollup.dueSoon).toBe(1);
    expect(r.rollup.pending).toBe(1);
    expect(r.rollup.draft).toBe(1);
    expect(r.rollup.withImpact).toBe(1); // only id=4 has costImpact
  });
});
