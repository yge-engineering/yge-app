import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildJobWarrantyTracker } from './job-warranty-tracker';

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

describe('buildJobWarrantyTracker', () => {
  it('skips jobs without a substantial-completion date', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [job({})],
      substantialCompletionByJobId: new Map(),
    });
    expect(r.rows).toHaveLength(0);
  });

  it('flags ACTIVE_NEW (0-90 days in)', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [job({})],
      substantialCompletionByJobId: new Map([['job-1', '2026-03-01']]),
    });
    expect(r.rows[0]?.flag).toBe('ACTIVE_NEW');
    expect(r.rows[0]?.daysInWarranty).toBe(57);
  });

  it('flags ACTIVE_MID (91-275 days in)', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [job({})],
      substantialCompletionByJobId: new Map([['job-1', '2025-10-01']]),
    });
    expect(r.rows[0]?.flag).toBe('ACTIVE_MID');
  });

  it('flags ACTIVE_LATE (276 days to warranty end)', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [job({})],
      substantialCompletionByJobId: new Map([['job-1', '2025-06-01']]),
    });
    expect(r.rows[0]?.flag).toBe('ACTIVE_LATE');
  });

  it('flags EXPIRED past the warranty end date', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [job({})],
      substantialCompletionByJobId: new Map([['job-1', '2024-01-01']]),
    });
    expect(r.rows[0]?.flag).toBe('EXPIRED');
    expect(r.rows[0]?.daysToEnd).toBe(null);
  });

  it('uses 365-day warranty by default', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [job({})],
      substantialCompletionByJobId: new Map([['job-1', '2026-01-01']]),
    });
    expect(r.rows[0]?.warrantyEndDate).toBe('2027-01-01');
  });

  it('respects custom warrantyDays', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      warrantyDays: 730,
      jobs: [job({})],
      substantialCompletionByJobId: new Map([['job-1', '2026-01-01']]),
    });
    expect(r.rows[0]?.warrantyEndDate).toBe('2028-01-01');
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awd', status: 'AWARDED' }),
      ],
      substantialCompletionByJobId: new Map([
        ['job-prosp', '2026-03-01'],
        ['job-awd', '2026-03-01'],
      ]),
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('job-awd');
  });

  it('rolls up active warranty exposure (excludes EXPIRED)', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [job({ id: 'j-active' }), job({ id: 'j-expired' })],
      substantialCompletionByJobId: new Map([
        ['j-active', '2026-01-01'],
        ['j-expired', '2024-01-01'],
      ]),
      contractValueByJobId: new Map([
        ['j-active', 1_000_000_00],
        ['j-expired', 5_000_000_00],
      ]),
    });
    expect(r.rollup.activeWarrantyExposureCents).toBe(1_000_000_00);
    expect(r.rollup.expired).toBe(1);
  });

  it('sorts ACTIVE_LATE first, then MID, then NEW, EXPIRED last', () => {
    const r = buildJobWarrantyTracker({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-new' }),
        job({ id: 'j-mid' }),
        job({ id: 'j-late' }),
        job({ id: 'j-expired' }),
      ],
      substantialCompletionByJobId: new Map([
        ['j-new', '2026-03-01'],     // ACTIVE_NEW
        ['j-mid', '2025-10-01'],     // ACTIVE_MID
        ['j-late', '2025-06-01'],    // ACTIVE_LATE
        ['j-expired', '2024-01-01'], // EXPIRED
      ]),
    });
    expect(r.rows[0]?.jobId).toBe('j-late');
    expect(r.rows[1]?.jobId).toBe('j-mid');
    expect(r.rows[2]?.jobId).toBe('j-new');
    expect(r.rows[3]?.jobId).toBe('j-expired');
  });
});
