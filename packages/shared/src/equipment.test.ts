import { describe, expect, it } from 'vitest';
import {
  isServiceDue,
  nextServiceDueUsage,
  serviceDueLevel,
  usageUntilService,
  type Equipment,
} from './equipment';

function eq(over: Partial<Equipment>): Equipment {
  return {
    id: 'eq-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    name: 'Test Unit',
    category: 'TRUCK',
    usageMetric: 'MILES',
    currentUsage: 0,
    status: 'IN_YARD',
    maintenanceLog: [],
    ...over,
  };
}

describe('nextServiceDueUsage', () => {
  it('returns undefined when no service interval is set', () => {
    expect(nextServiceDueUsage(eq({}))).toBeUndefined();
  });

  it('treats missing lastServiceUsage as 0', () => {
    expect(
      nextServiceDueUsage(eq({ serviceIntervalUsage: 5000 })),
    ).toBe(5000);
  });

  it('adds the interval to the last-service reading', () => {
    expect(
      nextServiceDueUsage(
        eq({ lastServiceUsage: 12_345, serviceIntervalUsage: 5000 }),
      ),
    ).toBe(17_345);
  });
});

describe('usageUntilService + serviceDueLevel', () => {
  it('returns positive remaining miles when not yet at interval', () => {
    const u = usageUntilService(
      eq({
        currentUsage: 13_000,
        lastServiceUsage: 12_000,
        serviceIntervalUsage: 5000,
      }),
    );
    expect(u).toBe(4000);
  });

  it('flags `warn` inside the last 10% of the interval', () => {
    expect(
      serviceDueLevel(
        eq({
          currentUsage: 16_500, // 16,500 + 500 to go = next at 17,000
          lastServiceUsage: 12_000,
          serviceIntervalUsage: 5000,
        }),
      ),
    ).toBe('warn');
  });

  it('flags `overdue` once past the next-service reading', () => {
    expect(
      serviceDueLevel(
        eq({
          currentUsage: 17_500,
          lastServiceUsage: 12_000,
          serviceIntervalUsage: 5000,
        }),
      ),
    ).toBe('overdue');
  });

  it('flags `ok` when comfortably under the interval', () => {
    expect(
      serviceDueLevel(
        eq({
          currentUsage: 13_000,
          lastServiceUsage: 12_000,
          serviceIntervalUsage: 5000,
        }),
      ),
    ).toBe('ok');
  });

  it('returns `none` when no interval set', () => {
    expect(serviceDueLevel(eq({}))).toBe('none');
  });

  it('isServiceDue is true on warn or overdue, false otherwise', () => {
    expect(isServiceDue(eq({ currentUsage: 0, serviceIntervalUsage: undefined }))).toBe(false);
    expect(isServiceDue(eq({ currentUsage: 13_000, lastServiceUsage: 12_000, serviceIntervalUsage: 5000 }))).toBe(false);
    expect(isServiceDue(eq({ currentUsage: 16_700, lastServiceUsage: 12_000, serviceIntervalUsage: 5000 }))).toBe(true);
    expect(isServiceDue(eq({ currentUsage: 25_000, lastServiceUsage: 12_000, serviceIntervalUsage: 5000 }))).toBe(true);
  });
});
