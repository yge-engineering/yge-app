import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';
import type { PunchItem } from './punch-list';
import type { Rfi } from './rfi';
import type { Submittal } from './submittal';

import { buildSubstantialCompletionReadiness } from './substantial-completion-readiness';

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

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    identifiedOn: '2026-04-01',
    location: 'Sta. 12+50',
    description: 'Concrete chip',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    rfiNumber: '14',
    subject: 'Curb detail',
    question: 'Which detail applies?',
    priority: 'MEDIUM',
    status: 'SENT',
    ...over,
  } as Rfi;
}

function submittal(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    submittalNumber: '01',
    title: 'Rebar shop drawings',
    spec: '03 20 00',
    status: 'SUBMITTED',
    ...over,
  } as Submittal;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    changeOrderNumber: 'CO-01',
    subject: 'Subgrade',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'AGENCY_REVIEW',
    proposedAt: '2026-01-15',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildSubstantialCompletionReadiness', () => {
  it('flags NO_SCOPE when nothing is open on the job', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [],
      rfis: [],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows[0]?.flag).toBe('NO_SCOPE');
  });

  it('flags READY when all blocker checks are zero (only minor punches open)', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [pi({ severity: 'MINOR', status: 'OPEN' })],
      rfis: [],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows[0]?.flag).toBe('READY');
    expect(r.rows[0]?.openMinorPunch).toBe(1);
    expect(r.rows[0]?.blockerCount).toBe(0);
  });

  it('flags CLOSE for 1-3 blockers', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [pi({ severity: 'MAJOR', status: 'OPEN' })],
      rfis: [rfi({ status: 'SENT' })],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows[0]?.flag).toBe('CLOSE');
    expect(r.rows[0]?.blockerCount).toBe(2);
  });

  it('flags NOT_READY for 4+ blockers', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'pi-1', severity: 'SAFETY' }),
        pi({ id: 'pi-2', severity: 'MAJOR' }),
      ],
      rfis: [
        rfi({ id: 'rfi-1', status: 'SENT' }),
        rfi({ id: 'rfi-2', status: 'SENT' }),
      ],
      submittals: [submittal({ status: 'REVISE_RESUBMIT' })],
      changeOrders: [],
    });
    expect(r.rows[0]?.flag).toBe('NOT_READY');
    expect(r.rows[0]?.blockerCount).toBe(5);
  });

  it('counts safety + major punches as blockers; minor as visibility-only', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'pi-1', severity: 'SAFETY' }),
        pi({ id: 'pi-2', severity: 'MAJOR' }),
        pi({ id: 'pi-3', severity: 'MINOR' }),
      ],
      rfis: [],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows[0]?.openSafetyPunch).toBe(1);
    expect(r.rows[0]?.openMajorPunch).toBe(1);
    expect(r.rows[0]?.openMinorPunch).toBe(1);
    expect(r.rows[0]?.blockerCount).toBe(2);
  });

  it('skips CLOSED/WAIVED punch items', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [
        pi({ id: 'pi-1', severity: 'SAFETY', status: 'CLOSED' }),
        pi({ id: 'pi-2', severity: 'MAJOR', status: 'WAIVED' }),
      ],
      rfis: [],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows[0]?.openSafetyPunch).toBe(0);
    expect(r.rows[0]?.openMajorPunch).toBe(0);
  });

  it('counts only SENT RFIs as open (DRAFT/ANSWERED/CLOSED/WITHDRAWN excluded)', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [],
      rfis: [
        rfi({ id: 'rfi-1', status: 'SENT' }),
        rfi({ id: 'rfi-2', status: 'DRAFT' }),
        rfi({ id: 'rfi-3', status: 'ANSWERED' }),
        rfi({ id: 'rfi-4', status: 'CLOSED' }),
        rfi({ id: 'rfi-5', status: 'WITHDRAWN' }),
      ],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows[0]?.openRfis).toBe(1);
  });

  it('counts pending submittals (DRAFT/SUBMITTED/REVISE_RESUBMIT)', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [],
      rfis: [],
      submittals: [
        submittal({ id: 'sub-1', status: 'DRAFT' }),
        submittal({ id: 'sub-2', status: 'SUBMITTED' }),
        submittal({ id: 'sub-3', status: 'REVISE_RESUBMIT' }),
        submittal({ id: 'sub-4', status: 'APPROVED' }),
        submittal({ id: 'sub-5', status: 'APPROVED_AS_NOTED' }),
      ],
      changeOrders: [],
    });
    expect(r.rows[0]?.pendingSubmittals).toBe(3);
  });

  it('counts open COs (PROPOSED/AGENCY_REVIEW/APPROVED) as blockers', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [job({})],
      punchItems: [],
      rfis: [],
      submittals: [],
      changeOrders: [
        co({ id: 'co-1', status: 'PROPOSED' }),
        co({ id: 'co-2', status: 'AGENCY_REVIEW' }),
        co({ id: 'co-3', status: 'APPROVED' }),
        co({ id: 'co-4', status: 'EXECUTED' }),
        co({ id: 'co-5', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.openCos).toBe(3);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awarded', status: 'AWARDED' }),
      ],
      punchItems: [],
      rfis: [],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('job-awarded');
  });

  it('sorts READY first, NO_SCOPE last', () => {
    const r = buildSubstantialCompletionReadiness({
      jobs: [
        job({ id: 'job-not-ready' }),
        job({ id: 'job-ready' }),
        job({ id: 'job-no-scope' }),
      ],
      punchItems: [
        pi({ id: 'pi-1', jobId: 'job-not-ready', severity: 'SAFETY' }),
        pi({ id: 'pi-2', jobId: 'job-not-ready', severity: 'MAJOR' }),
        pi({ id: 'pi-3', jobId: 'job-not-ready', severity: 'MAJOR' }),
        pi({ id: 'pi-4', jobId: 'job-not-ready', severity: 'MAJOR' }),
        pi({ id: 'pi-r', jobId: 'job-ready', severity: 'MINOR' }),
      ],
      rfis: [],
      submittals: [],
      changeOrders: [],
    });
    expect(r.rows[0]?.jobId).toBe('job-ready');
    expect(r.rows[r.rows.length - 1]?.jobId).toBe('job-no-scope');
  });
});
