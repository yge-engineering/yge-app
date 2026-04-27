import { describe, expect, it } from 'vitest';
import { buildPunchBoard } from './punch-board';
import type { PunchItem } from './punch-list';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'Sta. 12+50',
    description: 'Fix the thing',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildPunchBoard', () => {
  it('hides CLOSED and WAIVED by default', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'a', status: 'OPEN' }),
        pi({ id: 'b', status: 'CLOSED' }),
        pi({ id: 'c', status: 'WAIVED' }),
        pi({ id: 'd', status: 'IN_PROGRESS' }),
        pi({ id: 'e', status: 'DISPUTED' }),
      ],
    });
    expect(r.rows.map((x) => x.id).sort()).toEqual(['a', 'd', 'e']);
  });

  it('includes resolved when requested', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'a', status: 'OPEN' }),
        pi({ id: 'b', status: 'CLOSED' }),
      ],
      includeResolved: true,
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sorts SAFETY first, then MAJOR, then MINOR', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'minor', severity: 'MINOR' }),
        pi({ id: 'safety', severity: 'SAFETY' }),
        pi({ id: 'major', severity: 'MAJOR' }),
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['safety', 'major', 'minor']);
  });

  it('within severity, past-due first (largest pastDue), then oldest', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: 'a', severity: 'MAJOR', identifiedOn: '2026-04-20', dueOn: '2026-04-30' }),    // not yet due
        pi({ id: 'b', severity: 'MAJOR', identifiedOn: '2026-04-15', dueOn: '2026-04-20' }),    // 7 past due
        pi({ id: 'c', severity: 'MAJOR', identifiedOn: '2026-04-01', dueOn: '2026-04-10' }),    // 17 past due
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('rolls up by job with severity counts', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: '1', jobId: 'job-A', severity: 'SAFETY' }),
        pi({ id: '2', jobId: 'job-A', severity: 'MAJOR' }),
        pi({ id: '3', jobId: 'job-A', severity: 'MINOR' }),
        pi({ id: '4', jobId: 'job-B', severity: 'MINOR' }),
      ],
    });
    const a = r.byJob.find((x) => x.jobId === 'job-A')!;
    expect(a.totalOpen).toBe(3);
    expect(a.safety).toBe(1);
    expect(a.major).toBe(1);
    expect(a.minor).toBe(1);
  });

  it('byJob ranks by safety count, then major count, then oldest', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: '1', jobId: 'job-clean', severity: 'MINOR', identifiedOn: '2026-04-25' }),
        pi({ id: '2', jobId: 'job-bad', severity: 'SAFETY', identifiedOn: '2026-04-20' }),
        pi({ id: '3', jobId: 'job-aging', severity: 'MAJOR', identifiedOn: '2026-01-01' }),
      ],
    });
    expect(r.byJob.map((x) => x.jobId)).toEqual([
      'job-bad',     // safety wins
      'job-aging',   // major wins next
      'job-clean',   // minor only
    ]);
  });

  it('byParty rolls up across jobs; Unassigned bucket for items with no responsibleParty', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: '1', responsibleParty: 'Sub Co.', severity: 'SAFETY' }),
        pi({ id: '2', responsibleParty: 'Sub Co.', severity: 'MAJOR' }),
        pi({ id: '3', responsibleParty: undefined, severity: 'MINOR' }),
        pi({ id: '4', responsibleParty: 'In-house', severity: 'MINOR' }),
      ],
    });
    const sub = r.byParty.find((x) => x.party === 'Sub Co.')!;
    expect(sub.totalOpen).toBe(2);
    expect(sub.safety).toBe(1);
    const unassigned = r.byParty.find((x) => x.party === 'Unassigned')!;
    expect(unassigned.totalOpen).toBe(1);
  });

  it('totals.pastDue counts only items with positive daysPastDue', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [
        pi({ id: '1', dueOn: '2026-04-30' }),        // future
        pi({ id: '2', dueOn: '2026-04-20' }),        // past
        pi({ id: '3', dueOn: '2026-04-27' }),        // exactly today (0 → not counted)
        pi({ id: '4', dueOn: undefined }),           // no due
      ],
    });
    expect(r.totals.totalOpen).toBe(4);
    expect(r.totals.pastDue).toBe(1);
  });

  it('uses jobNamesById to print friendly names', () => {
    const r = buildPunchBoard({
      asOf: '2026-04-27',
      punchItems: [pi({ jobId: 'job-foo' })],
      jobNamesById: new Map([['job-foo', 'Sulphur Springs']]),
    });
    expect(r.rows[0]?.projectName).toBe('Sulphur Springs');
    expect(r.byJob[0]?.projectName).toBe('Sulphur Springs');
  });
});
