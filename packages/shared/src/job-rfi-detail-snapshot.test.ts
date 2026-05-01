import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildJobRfiDetailSnapshot } from './job-rfi-detail-snapshot';

function rf(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'X',
    question: '',
    status: 'SENT',
    priority: 'MEDIUM',
    costImpact: false,
    scheduleImpact: false,
    sentAt: '2026-04-10',
    askedByEmployeeId: 'e1',
    ...over,
  } as Rfi;
}

describe('buildJobRfiDetailSnapshot', () => {
  it('returns one row per author sorted by total', () => {
    const r = buildJobRfiDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      rfis: [
        rf({ id: 'a', jobId: 'j1', askedByEmployeeId: 'e1', status: 'CLOSED', sentAt: '2026-04-10', answeredAt: '2026-04-15' }),
        rf({ id: 'b', jobId: 'j1', askedByEmployeeId: 'e1', status: 'SENT', sentAt: '2026-04-12' }),
        rf({ id: 'c', jobId: 'j1', askedByEmployeeId: 'e2', status: 'ANSWERED', sentAt: '2026-04-14', answeredAt: '2026-04-18' }),
        rf({ id: 'd', jobId: 'j2', askedByEmployeeId: 'e1', status: 'SENT' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.authorEmployeeId).toBe('e1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.closed).toBe(1);
    expect(r.rows[0]?.open).toBe(1);
    expect(r.rows[0]?.avgDaysToAnswer).toBe(5);
    expect(r.rows[1]?.authorEmployeeId).toBe('e2');
    expect(r.rows[1]?.answered).toBe(1);
    expect(r.rows[1]?.avgDaysToAnswer).toBe(4);
  });

  it('handles unknown job', () => {
    const r = buildJobRfiDetailSnapshot({ jobId: 'X', rfis: [] });
    expect(r.rows.length).toBe(0);
  });
});
