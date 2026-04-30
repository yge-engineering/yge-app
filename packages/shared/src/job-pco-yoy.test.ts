import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildJobPcoYoy } from './job-pco-yoy';

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
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildJobPcoYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobPcoYoy({
      jobId: 'j1',
      currentYear: 2026,
      pcos: [
        pco({ id: 'a', noticedOn: '2025-04-15', costImpactCents: 30_000_00 }),
        pco({ id: 'b', noticedOn: '2026-04-15', costImpactCents: 50_000_00 }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.costImpactDelta).toBe(20_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobPcoYoy({ jobId: 'X', currentYear: 2026, pcos: [] });
    expect(r.priorTotal).toBe(0);
  });
});
