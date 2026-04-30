import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildJobSubmittalYoy } from './job-submittal-yoy';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    number: 1,
    title: 'T',
    specSection: '03 30 00',
    status: 'SUBMITTED',
    submittedAt: '2026-04-01T00:00:00Z',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildJobSubmittalYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobSubmittalYoy({
      jobId: 'j1',
      currentYear: 2026,
      submittals: [
        sub({ id: 'a', submittedAt: '2025-04-01T00:00:00Z' }),
        sub({ id: 'b', submittedAt: '2026-04-01T00:00:00Z', blocksOrdering: true }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.currentBlocksOrdering).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobSubmittalYoy({ jobId: 'X', currentYear: 2026, submittals: [] });
    expect(r.priorTotal).toBe(0);
  });
});
