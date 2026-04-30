import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildJobRfiYoy } from './job-rfi-yoy';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    number: 1,
    subject: 'T',
    question: 'Q',
    status: 'SENT',
    priority: 'MEDIUM',
    sentAt: '2026-04-01T00:00:00Z',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildJobRfiYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobRfiYoy({
      jobId: 'j1',
      currentYear: 2026,
      rfis: [
        rfi({ id: 'a', sentAt: '2025-04-01T00:00:00Z' }),
        rfi({ id: 'b', sentAt: '2026-04-01T00:00:00Z' }),
        rfi({ id: 'c', sentAt: '2026-04-01T00:00:00Z', jobId: 'j2' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobRfiYoy({ jobId: 'X', currentYear: 2026, rfis: [] });
    expect(r.priorTotal).toBe(0);
  });
});
