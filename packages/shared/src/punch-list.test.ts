import { describe, expect, it } from 'vitest';
import {
  computePunchListRollup,
  isOverdue,
  type PunchItem,
} from './punch-list';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    identifiedOn: '2026-04-01',
    location: 'Sta. 12+50',
    description: 'Replace damaged catch basin grate',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  };
}

describe('isOverdue', () => {
  it('returns true when an open item is past its due date', () => {
    const item = pi({ status: 'OPEN', dueOn: '2026-04-01' });
    expect(isOverdue(item, new Date('2026-04-15T12:00:00Z'))).toBe(true);
  });

  it('returns false for closed items even if past due', () => {
    const item = pi({ status: 'CLOSED', dueOn: '2026-04-01' });
    expect(isOverdue(item, new Date('2026-04-15T12:00:00Z'))).toBe(false);
  });

  it('returns false for items with no due date', () => {
    const item = pi({ status: 'OPEN' });
    expect(isOverdue(item)).toBe(false);
  });
});

describe('computePunchListRollup', () => {
  it('returns readyForCloseout=true when only minor items are open', () => {
    const r = computePunchListRollup([
      pi({ id: 'pi-11111111', status: 'OPEN', severity: 'MINOR' }),
      pi({ id: 'pi-22222222', status: 'CLOSED', severity: 'MAJOR' }),
    ]);
    expect(r.readyForCloseout).toBe(true);
    expect(r.openSafety).toBe(0);
  });

  it('returns readyForCloseout=false when a SAFETY item is open', () => {
    const r = computePunchListRollup([
      pi({ id: 'pi-11111111', status: 'OPEN', severity: 'SAFETY' }),
      pi({ id: 'pi-22222222', status: 'CLOSED', severity: 'MAJOR' }),
    ]);
    expect(r.readyForCloseout).toBe(false);
    expect(r.openSafety).toBe(1);
  });

  it('returns readyForCloseout=false when a MAJOR item is open', () => {
    const r = computePunchListRollup([
      pi({ id: 'pi-11111111', status: 'IN_PROGRESS', severity: 'MAJOR' }),
    ]);
    expect(r.readyForCloseout).toBe(false);
  });

  it('returns readyForCloseout=false when there are no items', () => {
    const r = computePunchListRollup([]);
    expect(r.readyForCloseout).toBe(false);
    expect(r.total).toBe(0);
  });

  it('counts overdue items only when still open', () => {
    const now = new Date('2026-04-15T12:00:00Z');
    const r = computePunchListRollup(
      [
        pi({ id: 'pi-11111111', status: 'OPEN', dueOn: '2026-04-01' }),
        pi({ id: 'pi-22222222', status: 'CLOSED', dueOn: '2026-04-01' }),
        pi({ id: 'pi-33333333', status: 'OPEN', dueOn: '2026-04-30' }),
      ],
      now,
    );
    expect(r.overdue).toBe(1);
  });
});
