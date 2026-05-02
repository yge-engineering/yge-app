import { describe, expect, it } from 'vitest';
import {
  RETENTION_RULES,
  computeRetentionStats,
  isPurgeEligible,
  purgeEligibleOn,
  rulesFor,
} from './records-retention';

describe('RETENTION_RULES', () => {
  it('every rule cites an authority', () => {
    for (const r of RETENTION_RULES) {
      expect(r.authority).toBeTruthy();
      expect(r.citation.length).toBeGreaterThan(10);
    }
  });

  it('every rule retains at least 3 years', () => {
    for (const r of RETENTION_RULES) {
      expect(r.retainYears).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('rulesFor', () => {
  it('returns the JournalEntry rule', () => {
    const rules = rulesFor('JournalEntry');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.retainYears).toBe(7);
  });

  it('returns multiple CompanyDocument rules (I-9 + insurance)', () => {
    const rules = rulesFor('CompanyDocument');
    expect(rules.length).toBeGreaterThanOrEqual(2);
  });

  it('returns [] for an unknown type', () => {
    // @ts-expect-error — testing the runtime filter
    expect(rulesFor('BogusType')).toEqual([]);
  });
});

describe('purgeEligibleOn', () => {
  it('adds the retention years to the trigger', () => {
    const rule = rulesFor('JournalEntry')[0]!;
    expect(purgeEligibleOn(rule, '2026-01-15')).toBe('2033-01-15');
  });

  it('handles ISO timestamps', () => {
    const rule = rulesFor('JournalEntry')[0]!;
    expect(purgeEligibleOn(rule, '2026-01-15T08:00:00Z')).toBe('2033-01-15');
  });

  it('returns empty string on unparseable input', () => {
    const rule = rulesFor('JournalEntry')[0]!;
    expect(purgeEligibleOn(rule, 'not-a-date')).toBe('');
  });
});

describe('isPurgeEligible', () => {
  const rule = rulesFor('TimeCard')[0]!; // 4 years from CREATED_AT

  it('false until the eligible date is reached', () => {
    expect(isPurgeEligible(rule, '2026-01-15', '2029-12-31')).toBe(false);
  });

  it('true on or after the eligible date', () => {
    expect(isPurgeEligible(rule, '2026-01-15', '2030-01-15')).toBe(true);
    expect(isPurgeEligible(rule, '2026-01-15', '2030-06-01')).toBe(true);
  });

  it('false when trigger is unparseable', () => {
    expect(isPurgeEligible(rule, 'bogus', '2099-01-01')).toBe(false);
  });
});

describe('computeRetentionStats', () => {
  it('rolls up authorities + finds the longest rule', () => {
    const stats = computeRetentionStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.byAuthority.IRS).toBeGreaterThanOrEqual(5);
    expect(stats.longestRetainYears).toBeGreaterThanOrEqual(30);
    expect(stats.longestRule?.entityType).toBe('EmployeeCertification');
  });
});
