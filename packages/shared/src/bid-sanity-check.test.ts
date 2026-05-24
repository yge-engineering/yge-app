// Coverage for the bid sanity check engine.
//
// Pin the rules so the SMUD-style $814K-vs-$3.1M failure mode shows
// up as a CRITICAL warning on the draft.

import { describe, it, expect } from 'vitest';
import { runBidSanityCheck, parseAssumptionRisk } from './bid-sanity-check';
import type { PtoEOutput } from './plans-to-estimate-output';

function draft(over: Partial<PtoEOutput> = {}): PtoEOutput {
  return {
    projectName: 'Test',
    projectType: 'GRADING',
    bidItems: [
      {
        itemNumber: '1',
        description: 'Excavation, native soil',
        unit: 'CY',
        quantity: 100,
        confidence: 'MEDIUM',
        estimatedUnitPriceCents: 5000,
        estimatedLineTotalCents: 500_000,
      },
    ],
    assumptions: [],
    ownerFurnishedItems: [],
    questionsForEstimator: [],
    overallConfidence: 'MEDIUM',
    estimatedBidTotalCents: 500_000,
    estimatedDurationCalendarMonths: 2,
    ...over,
  };
}

describe('runBidSanityCheck', () => {
  it('flags a missing schedule', () => {
    const findings = runBidSanityCheck({
      draft: draft({ estimatedDurationCalendarMonths: undefined }),
    });
    expect(findings.some((f) => f.id === 'schedule-missing')).toBe(true);
  });

  it('flags a too-short utility-substation schedule as CRITICAL', () => {
    const findings = runBidSanityCheck({
      draft: draft({
        projectType: 'GRADING',
        estimatedDurationCalendarMonths: 2, // utility minimum is 4
      }),
      agencyKind: 'MUNICIPAL_UTILITY',
    });
    const sched = findings.find((f) => f.id === 'schedule-too-short');
    expect(sched).toBeDefined();
    expect(sched!.severity).toBe('CRITICAL');
    expect(sched!.detail).toContain('inspection holds');
  });

  it('does NOT flag a 5-month utility schedule (above 4-month floor)', () => {
    const findings = runBidSanityCheck({
      draft: draft({ estimatedDurationCalendarMonths: 5 }),
      agencyKind: 'MUNICIPAL_UTILITY',
    });
    expect(findings.find((f) => f.id === 'schedule-too-short')).toBeUndefined();
  });

  it('flags hallucinated owner-furnishes assumptions as CRITICAL', () => {
    const findings = runBidSanityCheck({
      draft: draft({
        assumptions: [
          '[HIGH] Transformers and switchgear furnished by SMUD, civil contractor only provides foundations.',
          '[HIGH] Electrical conduit and grounding materials furnished by SMUD.',
        ],
        ownerFurnishedItems: [], // AI did not cite a source
      }),
    });
    const owner = findings.filter((f) => f.category === 'OWNER_FURNISHES');
    expect(owner.length).toBeGreaterThanOrEqual(2);
    expect(owner.every((f) => f.severity === 'CRITICAL')).toBe(true);
  });

  it('does NOT flag owner-furnishes when properly cited in ownerFurnishedItems', () => {
    const findings = runBidSanityCheck({
      draft: draft({
        assumptions: [
          '[HIGH] Transformers furnished by SMUD per page 12 spec.',
        ],
        ownerFurnishedItems: [
          'Transformers furnished by SMUD per page 12 spec.',
        ],
      }),
    });
    expect(findings.filter((f) => f.category === 'OWNER_FURNISHES')).toEqual([]);
  });

  it('flags a missing earthwork item on a GRADING project as CRITICAL', () => {
    const findings = runBidSanityCheck({
      draft: draft({
        projectType: 'GRADING',
        bidItems: [
          {
            itemNumber: '1',
            description: 'Mobilization',
            unit: 'LS',
            quantity: 1,
            confidence: 'HIGH',
            estimatedUnitPriceCents: 5_000_000,
            estimatedLineTotalCents: 5_000_000,
          },
        ],
        estimatedBidTotalCents: 5_000_000,
      }),
    });
    const earthwork = findings.find((f) => f.id === 'earthwork-missing');
    expect(earthwork).toBeDefined();
    expect(earthwork!.severity).toBe('CRITICAL');
  });

  it('flags a bid total below the YGE floor for the project type', () => {
    const findings = runBidSanityCheck({
      draft: draft({
        projectType: 'GRADING',
        estimatedBidTotalCents: 1_000_00, // $1k — way below floor
      }),
    });
    expect(findings.some((f) => f.id === 'bid-total-low')).toBe(true);
  });

  it('returns nothing-critical when a well-formed utility draft is passed', () => {
    const findings = runBidSanityCheck({
      draft: draft({
        projectType: 'GRADING',
        estimatedDurationCalendarMonths: 5,
        estimatedBidTotalCents: 2_500_000_00,
        assumptions: ['[MED] 20% O&P applied.'],
        ownerFurnishedItems: [],
      }),
      agencyKind: 'MUNICIPAL_UTILITY',
    });
    expect(findings.filter((f) => f.severity === 'CRITICAL')).toEqual([]);
  });

  it('sorts CRITICAL before WARNING before INFO', () => {
    const findings = runBidSanityCheck({
      draft: draft({
        projectType: 'GRADING',
        estimatedDurationCalendarMonths: undefined, // WARNING (missing)
        estimatedBidTotalCents: 1_000_00, // WARNING (below floor)
        bidItems: [
          {
            // No earthwork keyword in description / notes → CRITICAL
            itemNumber: '1',
            description: 'Mobilization',
            unit: 'LS',
            quantity: 1,
            confidence: 'HIGH',
          },
        ],
      }),
    });
    const severities = findings.map((f) => f.severity);
    // Critical must precede warnings.
    const firstCritical = severities.indexOf('CRITICAL');
    const firstWarning = severities.indexOf('WARNING');
    if (firstCritical >= 0 && firstWarning >= 0) {
      expect(firstCritical).toBeLessThan(firstWarning);
    }
  });
});

describe('parseAssumptionRisk', () => {
  it('parses [HIGH]', () => {
    const r = parseAssumptionRisk('[HIGH] Schedule assumes no rain delays.');
    expect(r.risk).toBe('HIGH');
    expect(r.text).toBe('Schedule assumes no rain delays.');
  });
  it('parses [MED]', () => {
    const r = parseAssumptionRisk('[MED] Source of import borrow TBD.');
    expect(r.risk).toBe('MEDIUM');
  });
  it('parses [LOW]', () => {
    const r = parseAssumptionRisk('[LOW] Color of curb paint per agency choice.');
    expect(r.risk).toBe('LOW');
  });
  it('defaults to MEDIUM when no tag', () => {
    const r = parseAssumptionRisk('Some untagged assumption.');
    expect(r.risk).toBe('MEDIUM');
    expect(r.text).toBe('Some untagged assumption.');
  });
});
