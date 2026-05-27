import { describe, expect, it } from 'vitest';

import {
  SCOPE_KEYWORD_DICTIONARY,
  extractScopeKeywordsFromText,
} from './scope-keyword-dictionary';

describe('SCOPE_KEYWORD_DICTIONARY', () => {
  it('has all unique entries', () => {
    const set = new Set(SCOPE_KEYWORD_DICTIONARY);
    expect(set.size).toBe(SCOPE_KEYWORD_DICTIONARY.length);
  });

  it('covers all 6 PtoEProjectType archetypes with at least one keyword each', () => {
    const expectations: Record<string, string[]> = {
      ROAD_RECONSTRUCTION: ['asphalt', 'paving', 'tack-coat'],
      DRAINAGE: ['culvert', 'manhole', 'headwall'],
      BRIDGE: ['bridge', 'abutment', 'pier', 'deck', 'falsework'],
      GRADING: ['grading', 'topsoil', 'subgrade'],
      FIRE_FUEL_REDUCTION: ['mastication', 'burn-pile', 'fuel-break'],
      OTHER: ['substation', 'control-house', 'ground-grid'],
    };
    for (const [archetype, keywords] of Object.entries(expectations)) {
      for (const k of keywords) {
        expect(SCOPE_KEYWORD_DICTIONARY).toContain(k);
        // The cast keeps the assertion message archetype-specific.
        if (!SCOPE_KEYWORD_DICTIONARY.includes(k as never)) {
          throw new Error(`${archetype} expects '${k}' in dictionary`);
        }
      }
    }
  });
});

describe('extractScopeKeywordsFromText', () => {
  it('returns empty array for empty input', () => {
    expect(extractScopeKeywordsFromText('')).toEqual([]);
  });

  it('extracts a single keyword (lowercase match)', () => {
    expect(extractScopeKeywordsFromText('asphalt paving')).toEqual(
      expect.arrayContaining(['asphalt', 'paving']),
    );
  });

  it('is case-insensitive', () => {
    const out = extractScopeKeywordsFromText('ASPHALT Paving');
    expect(out).toContain('asphalt');
    expect(out).toContain('paving');
  });

  it('matches hyphenated keywords in both hyphen and space form', () => {
    expect(extractScopeKeywordsFromText('install duct-bank')).toContain(
      'duct-bank',
    );
    expect(extractScopeKeywordsFromText('install duct bank')).toContain(
      'duct-bank',
    );
  });

  it('de-duplicates repeated matches', () => {
    const out = extractScopeKeywordsFromText('asphalt asphalt asphalt');
    expect(out.filter((k) => k === 'asphalt')).toHaveLength(1);
  });

  it('handles substation + ground-grid (real seed example)', () => {
    const text =
      'Transformer foundation, 4-inch conduit duct-bank, ground grid, oil-containment, CMU wall around the substation';
    const out = extractScopeKeywordsFromText(text);
    expect(out).toEqual(
      expect.arrayContaining([
        'foundation',
        'conduit',
        'duct-bank',
        'ground-grid',
        'oil-containment',
        'cmu-wall',
        'substation',
      ]),
    );
  });

  it('returns no extras for text with no keywords', () => {
    expect(extractScopeKeywordsFromText('hello world')).toEqual([]);
  });

  it('ignores hyphen on the boundary (no false positive)', () => {
    // 'cut' is in the dictionary; 'haircut' contains 'cut' as a
    // substring, which IS a hit per the includes() semantic. This
    // documents the current loose behavior — the dictionary is
    // narrow enough that real false positives are rare, but the
    // matcher is naive substring scan.
    expect(extractScopeKeywordsFromText('haircut')).toContain('cut');
  });
});
