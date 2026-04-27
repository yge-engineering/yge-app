import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { PunchItem } from './punch-list';

import { buildPunchCloseoutVelocity } from './punch-closeout-velocity';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'Sta. 12+50',
    description: 'cosmetic',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildPunchCloseoutVelocity', () => {
  it('flags NO_DATA when no punch items', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({})],
      punchItems: [],
    });
    expect(r.rows[0]?.flag).toBe('NO_DATA');
  });

  it('flags FAST when avg <14 days', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'p1', identifiedOn: '2026-04-01', closedOn: '2026-04-05', status: 'CLOSED' }),
        pi({ id: 'p2', identifiedOn: '2026-04-01', closedOn: '2026-04-08', status: 'CLOSED' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('FAST');
    expect(r.rows[0]?.avgDaysToClose).toBeLessThan(14);
  });

  it('flags NORMAL for 14-29 day avg', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({})],
      punchItems: [
        pi({ identifiedOn: '2026-04-01', closedOn: '2026-04-21', status: 'CLOSED' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('NORMAL');
  });

  it('flags SLOW for 30-59 day avg', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({})],
      punchItems: [
        pi({ identifiedOn: '2026-02-01', closedOn: '2026-03-15', status: 'CLOSED' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('SLOW');
  });

  it('flags STUCK when nothing closed but items open', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({})],
      punchItems: [pi({ status: 'OPEN' }), pi({ id: 'pi-2', status: 'IN_PROGRESS' })],
    });
    expect(r.rows[0]?.flag).toBe('STUCK');
  });

  it('counts CLOSED items in itemsClosed even without closedOn date', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({})],
      punchItems: [
        pi({ status: 'CLOSED', closedOn: undefined }),
      ],
    });
    expect(r.rows[0]?.itemsClosed).toBe(1);
    expect(r.rows[0]?.flag).toBe('NO_DATA'); // no avg computable
  });

  it('computes closeoutRate and itemsOpen', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'p1', status: 'CLOSED', closedOn: '2026-04-05' }),
        pi({ id: 'p2', status: 'CLOSED', closedOn: '2026-04-05' }),
        pi({ id: 'p3', status: 'OPEN' }),
        pi({ id: 'p4', status: 'IN_PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.itemsClosed).toBe(2);
    expect(r.rows[0]?.itemsOpen).toBe(2);
    expect(r.rows[0]?.closeoutRate).toBe(0.5);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      punchItems: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up totals + tier counts', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({ id: 'j-fast' }), job({ id: 'j-stuck' })],
      punchItems: [
        pi({ jobId: 'j-fast', id: 'p-1', identifiedOn: '2026-04-01', closedOn: '2026-04-05', status: 'CLOSED' }),
        pi({ jobId: 'j-stuck', id: 'p-2', status: 'OPEN' }),
      ],
    });
    expect(r.rollup.fast).toBe(1);
    expect(r.rollup.stuck).toBe(1);
    expect(r.rollup.totalIdentified).toBe(2);
    expect(r.rollup.totalClosed).toBe(1);
  });

  it('sorts STUCK first, FAST last', () => {
    const r = buildPunchCloseoutVelocity({
      jobs: [job({ id: 'j-fast' }), job({ id: 'j-stuck' })],
      punchItems: [
        pi({ jobId: 'j-fast', id: 'p-1', identifiedOn: '2026-04-01', closedOn: '2026-04-05', status: 'CLOSED' }),
        pi({ jobId: 'j-stuck', id: 'p-2', status: 'OPEN' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-stuck');
  });
});
