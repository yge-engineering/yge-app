import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';

import { buildEmployeeTenureBuckets } from './employee-tenure-buckets';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Test',
    lastName: 'Person',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    hiredOn: '2026-01-01',
    ...over,
  } as Employee;
}

describe('buildEmployeeTenureBuckets', () => {
  it('classifies by tenure bucket', () => {
    const r = buildEmployeeTenureBuckets({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({ id: 'new', hiredOn: '2026-04-01' }),       // 27 days → UNDER_90D
        emp({ id: 'six', hiredOn: '2025-10-01' }),       // ~7 mo → UNDER_1Y
        emp({ id: 'two', hiredOn: '2024-04-01' }),       // ~2 yr → ONE_TO_3
        emp({ id: 'four', hiredOn: '2022-04-01' }),      // ~4 yr → THREE_TO_5
        emp({ id: 'ten', hiredOn: '2016-04-01' }),       // ~10 yr → FIVE_PLUS
      ],
    });
    const find = (k: string) => r.rows.find((x) => x.bucket === k);
    expect(find('UNDER_90D')?.count).toBe(1);
    expect(find('UNDER_1Y')?.count).toBe(1);
    expect(find('ONE_TO_3')?.count).toBe(1);
    expect(find('THREE_TO_5')?.count).toBe(1);
    expect(find('FIVE_PLUS')?.count).toBe(1);
  });

  it('excludes non-active employees by default', () => {
    const r = buildEmployeeTenureBuckets({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'TERMINATED' }),
        emp({ id: 'c', status: 'LAID_OFF' }),
      ],
    });
    expect(r.rollup.totalActive).toBe(1);
    expect(r.rollup.excludedByStatus).toBe(2);
  });

  it('honors custom includeStatuses', () => {
    const r = buildEmployeeTenureBuckets({
      asOf: new Date('2026-04-28'),
      includeStatuses: ['ACTIVE', 'LAID_OFF'],
      employees: [
        emp({ id: 'a', status: 'ACTIVE' }),
        emp({ id: 'b', status: 'LAID_OFF' }),
        emp({ id: 'c', status: 'TERMINATED' }),
      ],
    });
    expect(r.rollup.totalActive).toBe(2);
  });

  it('falls back to createdAt slice when hiredOn missing', () => {
    const r = buildEmployeeTenureBuckets({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({
          id: 'a',
          hiredOn: undefined,
          createdAt: '2026-04-01T00:00:00.000Z',
        }),
      ],
    });
    expect(r.rollup.totalActive).toBe(1);
  });

  it('breaks down each bucket by classification', () => {
    const r = buildEmployeeTenureBuckets({
      asOf: new Date('2026-04-28'),
      employees: [
        emp({ id: 'a', hiredOn: '2026-04-01', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'b', hiredOn: '2026-04-01', classification: 'LABORER_GROUP_1' }),
      ],
    });
    const newBucket = r.rows.find((x) => x.bucket === 'UNDER_90D');
    expect(newBucket?.byClassification.OPERATING_ENGINEER_GROUP_1).toBe(1);
    expect(newBucket?.byClassification.LABORER_GROUP_1).toBe(1);
  });

  it('returns all five bucket rows', () => {
    const r = buildEmployeeTenureBuckets({
      asOf: new Date('2026-04-28'),
      employees: [emp({ hiredOn: '2026-04-01' })],
    });
    expect(r.rows).toHaveLength(5);
  });

  it('handles empty input', () => {
    const r = buildEmployeeTenureBuckets({ employees: [] });
    expect(r.rollup.totalActive).toBe(0);
  });
});
