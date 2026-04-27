import { describe, expect, it } from 'vitest';
import { buildSubmittalBoard } from './submittal-board';
import type { Submittal } from './submittal';

function s(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    submittalNumber: '1',
    subject: 'Rebar shop drawings',
    kind: 'SHOP_DRAWING',
    status: 'SUBMITTED',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildSubmittalBoard', () => {
  it('hides closed submittals by default', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ id: 'a', status: 'APPROVED' }),
        s({ id: 'b', status: 'REJECTED' }),
        s({ id: 'c', status: 'SUBMITTED', responseDueAt: '2026-05-01' }),
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['c']);
  });

  it('includes closed submittals when requested', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ id: 'a', status: 'APPROVED' }),
        s({ id: 'b', status: 'SUBMITTED', responseDueAt: '2026-05-01' }),
      ],
      includeClosed: true,
    });
    expect(r.rows.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('flags OVERDUE when responseDueAt has passed', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ status: 'SUBMITTED', responseDueAt: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.urgency).toBe('OVERDUE');
    expect(r.rows[0]?.daysToDue).toBe(-7);
  });

  it('flags CRITICAL when overdue + blocksOrdering', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({
          status: 'SUBMITTED',
          responseDueAt: '2026-04-20',
          blocksOrdering: true,
        }),
      ],
    });
    expect(r.rows[0]?.urgency).toBe('CRITICAL');
  });

  it('flags CRITICAL when overdue more than 14 days', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ status: 'SUBMITTED', responseDueAt: '2026-04-01' }),
      ],
    });
    expect(r.rows[0]?.urgency).toBe('CRITICAL');
    expect(r.rows[0]?.daysToDue).toBe(-26);
  });

  it('flags DUE_SOON when due within 5 days', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ status: 'SUBMITTED', responseDueAt: '2026-04-30' }),
      ],
    });
    expect(r.rows[0]?.urgency).toBe('DUE_SOON');
    expect(r.rows[0]?.daysToDue).toBe(3);
  });

  it('flags REVISE when status is REVISE_RESUBMIT', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ status: 'REVISE_RESUBMIT', responseDueAt: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.urgency).toBe('REVISE');
  });

  it('PENDING when no responseDueAt is set', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [s({ status: 'SUBMITTED', responseDueAt: undefined })],
    });
    expect(r.rows[0]?.urgency).toBe('PENDING');
    expect(r.rows[0]?.daysToDue).toBeNull();
  });

  it('sorts CRITICAL first, then OVERDUE, DUE_SOON, REVISE, PENDING', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ id: 'p', status: 'SUBMITTED', responseDueAt: '2026-06-15' }),
        s({ id: 'd', status: 'SUBMITTED', responseDueAt: '2026-04-30' }),
        s({ id: 'o', status: 'SUBMITTED', responseDueAt: '2026-04-20' }),
        s({ id: 'c', status: 'SUBMITTED', responseDueAt: '2026-04-20', blocksOrdering: true }),
        s({ id: 'r', status: 'REVISE_RESUBMIT' }),
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['c', 'o', 'd', 'r', 'p']);
  });

  it('within tier, blocksOrdering wins, then most-overdue first', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ id: 'old-block', status: 'SUBMITTED', responseDueAt: '2026-04-10', blocksOrdering: true }),
        s({ id: 'newer-block', status: 'SUBMITTED', responseDueAt: '2026-04-20', blocksOrdering: true }),
      ],
    });
    // Both CRITICAL (overdue + block). Most overdue first.
    expect(r.rows.map((x) => x.id)).toEqual(['old-block', 'newer-block']);
  });

  it('rollup counts each tier', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [
        s({ id: 'c', status: 'SUBMITTED', responseDueAt: '2026-04-01' }),  // CRITICAL (>14 overdue)
        s({ id: 'o', status: 'SUBMITTED', responseDueAt: '2026-04-25' }),  // OVERDUE
        s({ id: 'd', status: 'SUBMITTED', responseDueAt: '2026-04-30' }),  // DUE_SOON
        s({ id: 'p', status: 'SUBMITTED', responseDueAt: '2026-06-30' }),  // PENDING
        s({ id: 'r', status: 'REVISE_RESUBMIT' }),                         // REVISE → counts as pending
      ],
    });
    expect(r.rollup.total).toBe(5);
    expect(r.rollup.critical).toBe(1);
    expect(r.rollup.overdue).toBe(1);
    expect(r.rollup.dueSoon).toBe(1);
    expect(r.rollup.pending).toBe(2); // PENDING + REVISE
  });

  it('uses jobNamesById to print friendly names', () => {
    const r = buildSubmittalBoard({
      asOf: '2026-04-27',
      submittals: [s({ jobId: 'job-2026-foo', status: 'SUBMITTED', responseDueAt: '2026-05-01' })],
      jobNamesById: new Map([['job-2026-foo', 'Sulphur Springs']]),
    });
    expect(r.rows[0]?.projectName).toBe('Sulphur Springs');
  });
});
