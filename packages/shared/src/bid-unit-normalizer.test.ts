import { describe, it, expect } from 'vitest';

import {
  CANONICAL_UNITS,
  normalizeUnit,
  tryCanonicalizeUnit,
} from './bid-unit-normalizer';

describe('normalizeUnit', () => {
  it('maps common ton variants to TON', () => {
    for (const v of ['ton', 'TON', 'Ton', 'tons', 'TN', 'tn', 'T', 't', 'TON.', 'tonne']) {
      expect(normalizeUnit(v)).toBe('TON');
    }
  });

  it('maps linear-feet variants to LF', () => {
    for (const v of ['lf', 'LF', 'L.F.', 'lin ft', 'linear ft', 'linear feet', 'FT', 'feet', "'"]) {
      expect(normalizeUnit(v)).toBe('LF');
    }
  });

  it('maps cubic-yard variants to CY', () => {
    for (const v of ['cy', 'CY', 'c.y.', 'cu yd', 'cubic yards']) {
      expect(normalizeUnit(v)).toBe('CY');
    }
  });

  it('handles leading + trailing whitespace', () => {
    expect(normalizeUnit('  LF  ')).toBe('LF');
    expect(normalizeUnit('\tTON\n')).toBe('TON');
  });

  it('passes unknown units through (upper-cased) unchanged', () => {
    expect(normalizeUnit('mbtu')).toBe('MBTU');
    expect(normalizeUnit('parsec')).toBe('PARSEC');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeUnit('')).toBe('');
    expect(normalizeUnit('   ')).toBe('');
  });

  it('handles all common bid form units canonically', () => {
    expect(normalizeUnit('EA')).toBe('EA');
    expect(normalizeUnit('LS')).toBe('LS');
    expect(normalizeUnit('SY')).toBe('SY');
    expect(normalizeUnit('SF')).toBe('SF');
    expect(normalizeUnit('GAL')).toBe('GAL');
    expect(normalizeUnit('HR')).toBe('HR');
  });
});

describe('tryCanonicalizeUnit', () => {
  it('returns null for unknown units', () => {
    expect(tryCanonicalizeUnit('parsec')).toBeNull();
    expect(tryCanonicalizeUnit('mbtu')).toBeNull();
  });

  it('returns the canonical type for known aliases', () => {
    expect(tryCanonicalizeUnit('tons')).toBe('TON');
    expect(tryCanonicalizeUnit('lin ft')).toBe('LF');
  });
});

describe('CANONICAL_UNITS', () => {
  it('contains exactly the 13 canonical units', () => {
    expect(CANONICAL_UNITS).toHaveLength(13);
    expect(CANONICAL_UNITS).toContain('TON');
    expect(CANONICAL_UNITS).toContain('LF');
    expect(CANONICAL_UNITS).toContain('CY');
  });
});
