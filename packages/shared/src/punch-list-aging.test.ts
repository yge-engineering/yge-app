import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildPunchAging } from './punch-list-aging';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'Sta. 12+50',
    description: 'Concrete pour cosmetic chip',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildPunchAging', () => {
  it('skips CLOSED and WAIVED items', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'pi-1', status: 'CLOSED' }),
        pi({ id: 'pi-2', status: 'WAIVED' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalOpen).toBe(0);
  });

  it('classifies NEW (<14 days)', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [pi({ identifiedOn: '2026-04-20' })], // 7 days
    });
    expect(r.rows[0]?.flag).toBe('NEW');
    expect(r.rows[0]?.daysOpen).toBe(7);
  });

  it('classifies AGING (14-29)', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [pi({ identifiedOn: '2026-04-08' })], // 19 days
    });
    expect(r.rows[0]?.flag).toBe('AGING');
  });

  it('classifies STALE (30-59)', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [pi({ identifiedOn: '2026-03-15' })], // 43 days
    });
    expect(r.rows[0]?.flag).toBe('STALE');
  });

  it('classifies STUCK (60+)', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [pi({ identifiedOn: '2026-01-15' })], // 102 days
    });
    expect(r.rows[0]?.flag).toBe('STUCK');
  });

  it('flags pastDue when dueOn has passed', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [pi({ dueOn: '2026-04-15' })],
    });
    expect(r.rows[0]?.pastDue).toBe(true);
    expect(r.rollup.pastDueCount).toBe(1);
  });

  it('flags pastDue=false when dueOn is in the future', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [pi({ dueOn: '2026-05-15' })],
    });
    expect(r.rows[0]?.pastDue).toBe(false);
  });

  it('rolls up counts by severity', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'pi-1', severity: 'SAFETY' }),
        pi({ id: 'pi-2', severity: 'MAJOR' }),
        pi({ id: 'pi-3', severity: 'MAJOR' }),
        pi({ id: 'pi-4', severity: 'MINOR' }),
      ],
    });
    expect(r.rollup.safetyOpen).toBe(1);
    expect(r.rollup.majorOpen).toBe(2);
    expect(r.rollup.minorOpen).toBe(1);
  });

  it('rolls up byParty with counts and oldest day', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'pi-1', responsibleParty: 'Acme Subs', identifiedOn: '2026-04-20', severity: 'SAFETY' }),
        pi({ id: 'pi-2', responsibleParty: 'Acme Subs', identifiedOn: '2026-01-01', severity: 'MAJOR' }),
        pi({ id: 'pi-3', responsibleParty: 'YGE crew', identifiedOn: '2026-04-15', severity: 'MINOR' }),
      ],
    });
    const acme = r.byParty.find((p) => p.responsibleParty === 'Acme Subs');
    expect(acme?.openCount).toBe(2);
    expect(acme?.oldestDaysOpen).toBeGreaterThan(100);
    expect(acme?.safetyCount).toBe(1);
    expect(acme?.majorCount).toBe(1);
  });

  it('falls back to "Unassigned" when responsibleParty missing', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [pi({ responsibleParty: undefined })],
    });
    expect(r.rows[0]?.responsibleParty).toBe('Unassigned');
    expect(r.byParty[0]?.responsibleParty).toBe('Unassigned');
  });

  it('sorts STUCK first, SAFETY before MAJOR within tier, days-open desc', () => {
    const r = buildPunchAging({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'pi-new-safety', severity: 'SAFETY', identifiedOn: '2026-04-20' }),
        pi({ id: 'pi-stuck-minor', severity: 'MINOR', identifiedOn: '2026-01-01' }),
        pi({ id: 'pi-stuck-safety', severity: 'SAFETY', identifiedOn: '2026-01-15' }),
      ],
    });
    expect(r.rows[0]?.punchItemId).toBe('pi-stuck-safety');
    expect(r.rows[1]?.punchItemId).toBe('pi-stuck-minor');
    expect(r.rows[2]?.punchItemId).toBe('pi-new-safety');
  });
});
