import { describe, it, expect } from 'vitest';
import {
  YearEndStateInputSchema,
  buildYearEndChecklist,
  openSteps,
  progressPct,
  type YearEndStateInput,
} from './year-end-checklist';

function state(over: Partial<YearEndStateInput> = {}): YearEndStateInput {
  return YearEndStateInputSchema.parse({
    yearEndDate: '2026-12-31',
    apUnpostedCount: 0,
    arUnpostedCount: 0,
    lastBankRecDate: '2026-12-31',
    payrollReconciled: true,
    cprMissingWeeks: 0,
    tax1099Reviewed: true,
    fixedAssetsUpdated: true,
    depreciationPosted: true,
    wipFrozen: true,
    wcAuditExported: true,
    taxCpaPackageSent: true,
    booksLocked: true,
    ...over,
  });
}

describe('buildYearEndChecklist — happy path', () => {
  it('returns 12 steps in order', () => {
    const steps = buildYearEndChecklist(state());
    expect(steps).toHaveLength(12);
    expect(steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('all DONE when state is fully closed', () => {
    const steps = buildYearEndChecklist(state());
    expect(steps.every((s) => s.status === 'DONE')).toBe(true);
    expect(progressPct(steps)).toBe(1);
  });
});

describe('buildYearEndChecklist — individual steps', () => {
  it('AP_POSTED is IN_PROGRESS with count', () => {
    const steps = buildYearEndChecklist(state({ apUnpostedCount: 7 }));
    const ap = steps.find((s) => s.kind === 'AP_POSTED')!;
    expect(ap.status).toBe('IN_PROGRESS');
    expect(ap.nextAction).toContain('7 unposted AP');
  });

  it('BANK_RECS_DONE is TODO when last rec date is null', () => {
    const steps = buildYearEndChecklist(state({ lastBankRecDate: null }));
    const br = steps.find((s) => s.kind === 'BANK_RECS_DONE')!;
    expect(br.status).toBe('TODO');
    expect(br.nextAction).toContain('never');
  });

  it('BANK_RECS_DONE is DONE when last rec date equals year-end', () => {
    const steps = buildYearEndChecklist(state({ lastBankRecDate: '2026-12-31' }));
    expect(steps.find((s) => s.kind === 'BANK_RECS_DONE')!.status).toBe('DONE');
  });

  it('BANK_RECS_DONE is TODO when last rec is before year-end', () => {
    const steps = buildYearEndChecklist(state({ lastBankRecDate: '2026-11-30' }));
    expect(steps.find((s) => s.kind === 'BANK_RECS_DONE')!.status).toBe('TODO');
  });

  it('CPRS_FILED is IN_PROGRESS with missing-weeks count', () => {
    const steps = buildYearEndChecklist(state({ cprMissingWeeks: 3 }));
    const cpr = steps.find((s) => s.kind === 'CPRS_FILED')!;
    expect(cpr.status).toBe('IN_PROGRESS');
    expect(cpr.nextAction).toContain('3 CPR weeks');
  });
});

describe('buildYearEndChecklist — gating', () => {
  it('DEPRECIATION_POSTED is BLOCKED when fixed-assets not yet updated', () => {
    const steps = buildYearEndChecklist(
      state({ fixedAssetsUpdated: false, depreciationPosted: false }),
    );
    const dep = steps.find((s) => s.kind === 'DEPRECIATION_POSTED')!;
    expect(dep.status).toBe('BLOCKED');
  });

  it('TAX_CPA_PACKAGE is BLOCKED when prerequisites missing', () => {
    const steps = buildYearEndChecklist(
      state({ tax1099Reviewed: false, taxCpaPackageSent: false }),
    );
    const cpa = steps.find((s) => s.kind === 'TAX_CPA_PACKAGE')!;
    expect(cpa.status).toBe('BLOCKED');
  });

  it('BOOKS_LOCKED is BLOCKED when CPA package not yet sent', () => {
    const steps = buildYearEndChecklist(
      state({ taxCpaPackageSent: false, booksLocked: false }),
    );
    const lock = steps.find((s) => s.kind === 'BOOKS_LOCKED')!;
    expect(lock.status).toBe('BLOCKED');
  });
});

describe('openSteps + progressPct', () => {
  it('openSteps filters out DONE rows', () => {
    const steps = buildYearEndChecklist(state({ apUnpostedCount: 1 }));
    const open = openSteps(steps);
    expect(open.every((s) => s.status !== 'DONE')).toBe(true);
    expect(open.find((s) => s.kind === 'AP_POSTED')).toBeDefined();
  });

  it('progressPct computes share done', () => {
    // 11 of 12 done → 0.9167
    const steps = buildYearEndChecklist(state({ booksLocked: false }));
    expect(progressPct(steps)).toBeCloseTo(11 / 12, 4);
  });
});
