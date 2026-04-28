import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Submittal } from './submittal';

import { buildJobSubmittalKindMix } from './job-submittal-kind-mix';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    submittalNumber: '1',
    subject: 's',
    kind: 'SHOP_DRAWING',
    status: 'SUBMITTED',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildJobSubmittalKindMix', () => {
  it('groups submittals by kind', () => {
    const r = buildJobSubmittalKindMix({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', kind: 'SHOP_DRAWING' }),
        sub({ id: 'b', kind: 'SHOP_DRAWING' }),
        sub({ id: 'c', kind: 'PRODUCT_DATA' }),
        sub({ id: 'd', kind: 'MIX_DESIGN' }),
      ],
    });
    const byKind = r.rows[0]?.byKind ?? [];
    const sd = byKind.find((x) => x.kind === 'SHOP_DRAWING');
    expect(sd?.total).toBe(2);
    expect(sd?.share).toBe(0.5);
  });

  it('counts open submittals (DRAFT / SUBMITTED / REVISE_RESUBMIT)', () => {
    const r = buildJobSubmittalKindMix({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', kind: 'SHOP_DRAWING', status: 'DRAFT' }),
        sub({ id: 'b', kind: 'SHOP_DRAWING', status: 'SUBMITTED' }),
        sub({ id: 'c', kind: 'SHOP_DRAWING', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', kind: 'SHOP_DRAWING', status: 'APPROVED' }),
      ],
    });
    const sd = r.rows[0]?.byKind.find((x) => x.kind === 'SHOP_DRAWING');
    expect(sd?.open).toBe(3);
    expect(sd?.total).toBe(4);
  });

  it('sorts kinds within job by total desc', () => {
    const r = buildJobSubmittalKindMix({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', kind: 'SAMPLE' }),
        sub({ id: 'b', kind: 'SHOP_DRAWING' }),
        sub({ id: 'c', kind: 'SHOP_DRAWING' }),
        sub({ id: 'd', kind: 'SHOP_DRAWING' }),
      ],
    });
    expect(r.rows[0]?.byKind[0]?.kind).toBe('SHOP_DRAWING');
  });

  it('AWARDED-only by default', () => {
    const r = buildJobSubmittalKindMix({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      submittals: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts jobs by total submittals desc', () => {
    const r = buildJobSubmittalKindMix({
      jobs: [
        job({ id: 'small' }),
        job({ id: 'big' }),
      ],
      submittals: [
        sub({ id: 's', jobId: 'small' }),
        sub({ id: 'b1', jobId: 'big' }),
        sub({ id: 'b2', jobId: 'big' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('rolls up portfolio by-kind totals', () => {
    const r = buildJobSubmittalKindMix({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', kind: 'SHOP_DRAWING' }),
        sub({ id: 'b', kind: 'SHOP_DRAWING' }),
        sub({ id: 'c', kind: 'WARRANTY' }),
      ],
    });
    expect(r.rollup.portfolioByKind.SHOP_DRAWING).toBe(2);
    expect(r.rollup.portfolioByKind.WARRANTY).toBe(1);
    expect(r.rollup.totalSubmittals).toBe(3);
  });

  it('handles empty input', () => {
    const r = buildJobSubmittalKindMix({ jobs: [], submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
