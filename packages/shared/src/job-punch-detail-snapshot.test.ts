import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildJobPunchDetailSnapshot } from './job-punch-detail-snapshot';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Sta. 12+50',
    description: 'X',
    severity: 'MINOR',
    status: 'OPEN',
    responsibleParty: 'Granite',
    ...over,
  } as PunchItem;
}

describe('buildJobPunchDetailSnapshot', () => {
  it('returns one row per responsible party sorted by open', () => {
    const r = buildJobPunchDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      punchItems: [
        pi({ id: 'a', jobId: 'j1', responsibleParty: 'Granite', status: 'OPEN', severity: 'SAFETY', dueOn: '2026-04-20' }),
        pi({ id: 'b', jobId: 'j1', responsibleParty: 'Granite', status: 'IN_PROGRESS', severity: 'MAJOR' }),
        pi({ id: 'c', jobId: 'j1', responsibleParty: 'YGE crew', status: 'CLOSED', severity: 'MINOR' }),
        pi({ id: 'd', jobId: 'j1', responsibleParty: 'YGE crew', status: 'OPEN', severity: 'MINOR' }),
        pi({ id: 'e', jobId: 'j2', responsibleParty: 'Granite', status: 'OPEN' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.responsibleParty).toBe('Granite');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.open).toBe(2);
    expect(r.rows[0]?.safety).toBe(1);
    expect(r.rows[0]?.major).toBe(1);
    expect(r.rows[0]?.overdue).toBe(1);
    expect(r.rows[1]?.responsibleParty).toBe('YGE crew');
    expect(r.rows[1]?.open).toBe(1);
    expect(r.rows[1]?.closed).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobPunchDetailSnapshot({ jobId: 'X', punchItems: [] });
    expect(r.rows.length).toBe(0);
  });
});
