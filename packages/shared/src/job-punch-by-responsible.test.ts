import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { PunchItem } from './punch-list';

import { buildJobPunchByResponsible } from './job-punch-by-responsible';

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

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    description: 'Item',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildJobPunchByResponsible', () => {
  it('groups items by canonicalized responsibleParty', () => {
    const r = buildJobPunchByResponsible({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'a', responsibleParty: 'ABC Paving' }),
        pi({ id: 'b', responsibleParty: 'ABC PAVING, INC.' }),
        pi({ id: 'c', responsibleParty: 'XYZ Concrete' }),
      ],
    });
    expect(r.rows[0]?.parties).toHaveLength(2);
  });

  it('counts by status', () => {
    const r = buildJobPunchByResponsible({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'o', responsibleParty: 'ABC', status: 'OPEN' }),
        pi({ id: 'p', responsibleParty: 'ABC', status: 'IN_PROGRESS' }),
        pi({ id: 'c', responsibleParty: 'ABC', status: 'CLOSED' }),
        pi({ id: 'w', responsibleParty: 'ABC', status: 'WAIVED' }),
        pi({ id: 'd', responsibleParty: 'ABC', status: 'DISPUTED' }),
      ],
    });
    const abc = r.rows[0]?.parties[0];
    expect(abc?.open).toBe(1);
    expect(abc?.inProgress).toBe(1);
    expect(abc?.closed).toBe(1);
    expect(abc?.waived).toBe(1);
    expect(abc?.disputed).toBe(1);
  });

  it('counts MAJOR + SAFETY open items in highSeverityOpen', () => {
    const r = buildJobPunchByResponsible({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'maj', responsibleParty: 'ABC', severity: 'MAJOR', status: 'OPEN' }),
        pi({ id: 'safe', responsibleParty: 'ABC', severity: 'SAFETY', status: 'IN_PROGRESS' }),
        pi({ id: 'safeClosed', responsibleParty: 'ABC', severity: 'SAFETY', status: 'CLOSED' }),
        pi({ id: 'min', responsibleParty: 'ABC', severity: 'MINOR', status: 'OPEN' }),
      ],
    });
    expect(r.rows[0]?.parties[0]?.highSeverityOpen).toBe(2);
  });

  it('captures oldest open age in days', () => {
    const r = buildJobPunchByResponsible({
      asOf: '2026-04-30',
      jobs: [job({})],
      punchItems: [
        pi({ id: 'old', responsibleParty: 'ABC', identifiedOn: '2026-04-01', status: 'OPEN' }),
        pi({ id: 'new', responsibleParty: 'ABC', identifiedOn: '2026-04-25', status: 'OPEN' }),
      ],
    });
    expect(r.rows[0]?.parties[0]?.oldestOpenDays).toBe(29);
  });

  it('null oldest when no open/in-progress for that party', () => {
    const r = buildJobPunchByResponsible({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'c', responsibleParty: 'ABC', status: 'CLOSED' }),
      ],
    });
    expect(r.rows[0]?.parties[0]?.oldestOpenDays).toBe(null);
  });

  it('groups items with no responsibleParty as (unassigned)', () => {
    const r = buildJobPunchByResponsible({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'a' }), // no responsibleParty
        pi({ id: 'b', responsibleParty: 'ABC' }),
      ],
    });
    const unassigned = r.rows[0]?.parties.find(
      (p) => p.responsibleParty === '(unassigned)',
    );
    expect(unassigned?.total).toBe(1);
    expect(r.rows[0]?.unassignedTotal).toBe(1);
    expect(r.rows[0]?.unassignedOpen).toBe(1);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobPunchByResponsible({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      punchItems: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts parties within job by open count desc', () => {
    const r = buildJobPunchByResponsible({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'a1', responsibleParty: 'A', status: 'OPEN' }),
        pi({ id: 'b1', responsibleParty: 'B', status: 'OPEN' }),
        pi({ id: 'b2', responsibleParty: 'B', status: 'OPEN' }),
        pi({ id: 'b3', responsibleParty: 'B', status: 'OPEN' }),
      ],
    });
    expect(r.rows[0]?.parties[0]?.responsibleParty).toBe('B');
  });

  it('sorts jobs by openItems desc', () => {
    const r = buildJobPunchByResponsible({
      jobs: [
        job({ id: 'low' }),
        job({ id: 'high' }),
      ],
      punchItems: [
        pi({ id: 'l', jobId: 'low', responsibleParty: 'X', status: 'OPEN' }),
        pi({ id: 'h1', jobId: 'high', responsibleParty: 'X', status: 'OPEN' }),
        pi({ id: 'h2', jobId: 'high', responsibleParty: 'X', status: 'OPEN' }),
        pi({ id: 'h3', jobId: 'high', responsibleParty: 'X', status: 'OPEN' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('high');
  });

  it('rolls up portfolio totals + unassigned-open', () => {
    const r = buildJobPunchByResponsible({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'a', responsibleParty: 'X', status: 'OPEN' }),
        pi({ id: 'b' }),
        pi({ id: 'c' }),
      ],
    });
    expect(r.rollup.totalItems).toBe(3);
    expect(r.rollup.totalOpen).toBe(3);
    expect(r.rollup.totalUnassignedOpen).toBe(2);
  });
});
