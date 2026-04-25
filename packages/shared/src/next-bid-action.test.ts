import { describe, expect, it } from 'vitest';
import { nextBidAction } from './next-bid-action';

const JOB_ID = 'job-2026-04-30-sulphur-springs-deadbeef';

describe('nextBidAction', () => {
  it('suggests running Plans-to-Estimate when nothing exists yet', () => {
    const a = nextBidAction(JOB_ID, { drafts: [], estimates: [] });
    expect(a.id).toBe('run-plans-to-estimate');
    expect(a.href).toContain('/plans-to-estimate');
    expect(a.href).toContain(JOB_ID);
  });

  it('suggests converting the newest draft when only drafts exist', () => {
    const a = nextBidAction(JOB_ID, {
      drafts: [
        { id: 'd-newest', createdAt: '2026-04-25T00:00:00Z' },
        { id: 'd-older', createdAt: '2026-04-24T00:00:00Z' },
      ],
      estimates: [],
    });
    expect(a.id).toBe('convert-draft');
    expect(a.href).toBe('/drafts/d-newest');
  });

  it('suggests pricing remaining lines when an estimate has unpriced items', () => {
    const a = nextBidAction(JOB_ID, {
      drafts: [],
      estimates: [
        {
          id: 'e-1',
          bidItemCount: 10,
          pricedLineCount: 7,
          unpricedLineCount: 3,
          bidTotalCents: 1_000_00,
        },
      ],
    });
    expect(a.id).toBe('price-lines');
    expect(a.label).toContain('3 lines');
    expect(a.href).toBe('/estimates/e-1');
  });

  it('suggests acknowledging addenda when any are un-acked', () => {
    const a = nextBidAction(JOB_ID, {
      drafts: [],
      estimates: [
        {
          id: 'e-1',
          bidItemCount: 10,
          pricedLineCount: 10,
          unpricedLineCount: 0,
          unacknowledgedAddendumCount: 2,
          bidTotalCents: 5_000_00,
        },
      ],
    });
    expect(a.id).toBe('ack-addenda');
    expect(a.label).toContain('2 addenda');
  });

  it('uses singular form for one un-acked addendum', () => {
    const a = nextBidAction(JOB_ID, {
      drafts: [],
      estimates: [
        {
          id: 'e-1',
          bidItemCount: 10,
          pricedLineCount: 10,
          unpricedLineCount: 0,
          unacknowledgedAddendumCount: 1,
          bidTotalCents: 5_000_00,
        },
      ],
    });
    expect(a.label).toContain('1 addendum');
  });

  it('points to the envelope checklist when everything is ready', () => {
    const a = nextBidAction(JOB_ID, {
      drafts: [],
      estimates: [
        {
          id: 'e-1',
          bidItemCount: 10,
          pricedLineCount: 10,
          unpricedLineCount: 0,
          unacknowledgedAddendumCount: 0,
          bidTotalCents: 5_000_00,
        },
      ],
    });
    expect(a.id).toBe('print-envelope');
    expect(a.done).toBe(true);
    expect(a.href).toBe('/estimates/e-1/envelope');
  });
});
