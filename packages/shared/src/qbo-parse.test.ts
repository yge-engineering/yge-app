import { describe, expect, it } from 'vitest';
import { parseQboAmountToCents, parseQboDate } from './qbo-parse';

describe('parseQboAmountToCents', () => {
  it('parses dollar/comma formatted amounts', () => {
    expect(parseQboAmountToCents('$1,234.56')).toBe(123456);
    expect(parseQboAmountToCents('1,234.56')).toBe(123456);
    expect(parseQboAmountToCents('1234.5')).toBe(123450);
    expect(parseQboAmountToCents('50')).toBe(5000);
  });

  it('treats accounting parentheses as negative', () => {
    expect(parseQboAmountToCents('(50.00)')).toBe(-5000);
    expect(parseQboAmountToCents('($1,000.00)')).toBe(-100000);
  });

  it('handles leading minus', () => {
    expect(parseQboAmountToCents('-50')).toBe(-5000);
  });

  it('rounds to the nearest cent', () => {
    expect(parseQboAmountToCents('10.005')).toBe(1001);
    expect(parseQboAmountToCents('10.004')).toBe(1000);
  });

  it('returns null for blank / dash / garbage', () => {
    expect(parseQboAmountToCents('')).toBeNull();
    expect(parseQboAmountToCents('   ')).toBeNull();
    expect(parseQboAmountToCents('-')).toBeNull();
    expect(parseQboAmountToCents('—')).toBeNull();
    expect(parseQboAmountToCents('N/A')).toBeNull();
    expect(parseQboAmountToCents(undefined)).toBeNull();
  });
});

describe('parseQboDate', () => {
  it('parses US slash dates', () => {
    expect(parseQboDate('03/15/2026')).toBe('2026-03-15');
    expect(parseQboDate('3/5/2026')).toBe('2026-03-05');
  });

  it('maps two-digit years to 2000s', () => {
    expect(parseQboDate('3/5/26')).toBe('2026-03-05');
  });

  it('passes ISO through', () => {
    expect(parseQboDate('2026-03-15')).toBe('2026-03-15');
  });

  it('accepts dash-separated US dates', () => {
    expect(parseQboDate('03-15-2026')).toBe('2026-03-15');
  });

  it('returns null for blank or unrecognized', () => {
    expect(parseQboDate('')).toBeNull();
    expect(parseQboDate('March 15, 2026')).toBeNull();
    expect(parseQboDate('13/40/2026')).toBeNull();
    expect(parseQboDate(undefined)).toBeNull();
  });
});
