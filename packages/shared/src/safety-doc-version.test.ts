import { describe, it, expect } from 'vitest';
import {
  SafetyDocumentSchema,
  SafetyDocumentVersionSchema,
  currentVersionAt,
  historicalChain,
  markSuperseded,
  pendingChanges,
  staleByDays,
  type SafetyDocumentVersion,
} from './safety-doc-version';

function ver(over: Partial<SafetyDocumentVersion>): SafetyDocumentVersion {
  return SafetyDocumentVersionSchema.parse({
    id: 'v1',
    documentId: 'iipp-cottonwood',
    versionLabel: 'v1',
    effectiveOn: '2026-01-01',
    summary: 'Initial release.',
    ...over,
  });
}

describe('SafetyDocumentSchema', () => {
  it('parses a typical IIPP record', () => {
    const d = SafetyDocumentSchema.parse({
      id: 'iipp-cottonwood',
      kind: 'IIPP',
      title: 'Cottonwood Yard IIPP',
    });
    expect(d.jurisdiction).toBe('CA');
  });
});

describe('currentVersionAt', () => {
  it('returns the most recent effective-before version', () => {
    const versions = [
      ver({ id: 'v1', versionLabel: 'v1', effectiveOn: '2026-01-01', supersededOn: '2026-04-01' }),
      ver({ id: 'v2', versionLabel: 'v2', effectiveOn: '2026-04-01' }),
    ];
    expect(currentVersionAt(versions, '2026-03-15')?.id).toBe('v1');
    expect(currentVersionAt(versions, '2026-04-01')?.id).toBe('v2');
    expect(currentVersionAt(versions, '2026-05-22')?.id).toBe('v2');
  });

  it('returns null when no version was effective by the date', () => {
    const versions = [ver({ id: 'v1', effectiveOn: '2026-06-01' })];
    expect(currentVersionAt(versions, '2026-05-22')).toBeNull();
  });

  it('skips a version that was superseded before asOfDate', () => {
    const versions = [
      ver({ id: 'v1', effectiveOn: '2026-01-01', supersededOn: '2026-03-01' }),
    ];
    expect(currentVersionAt(versions, '2026-05-22')).toBeNull();
  });
});

describe('historicalChain', () => {
  it('sorts ascending by effectiveOn (stable)', () => {
    const versions = [
      ver({ id: 'a', effectiveOn: '2026-04-01' }),
      ver({ id: 'b', effectiveOn: '2026-01-01' }),
      ver({ id: 'c', effectiveOn: '2026-02-01' }),
    ];
    const chain = historicalChain(versions);
    expect(chain.map((v) => v.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('markSuperseded', () => {
  it('sets supersededOn to the next version effective date', () => {
    const prev = ver({ id: 'v1', effectiveOn: '2026-01-01' });
    const next = ver({ id: 'v2', effectiveOn: '2026-04-01' });
    const r = markSuperseded(prev, next);
    expect(r.supersededOn).toBe('2026-04-01');
    // Original is untouched.
    expect(prev.supersededOn).toBeUndefined();
  });

  it('throws on documentId mismatch', () => {
    const prev = ver({ id: 'v1', documentId: 'iipp-a' });
    const next = ver({ id: 'v2', documentId: 'iipp-b' });
    expect(() => markSuperseded(prev, next)).toThrow(/documentId mismatch/);
  });

  it('throws when next is not strictly later', () => {
    const prev = ver({ id: 'v1', effectiveOn: '2026-04-01' });
    const sameOrBefore = ver({ id: 'v2', effectiveOn: '2026-04-01' });
    expect(() => markSuperseded(prev, sameOrBefore)).toThrow(/must be after/);
  });
});

describe('pendingChanges', () => {
  it('returns versions effective in the upcoming window', () => {
    const versions = [
      ver({ id: 'v1', effectiveOn: '2026-01-01' }),
      ver({ id: 'v2', effectiveOn: '2026-06-15' }),
      ver({ id: 'v3', effectiveOn: '2026-06-25' }),
      ver({ id: 'v4', effectiveOn: '2026-09-01' }),
    ];
    const r = pendingChanges(versions, '2026-05-22', 60);
    expect(r.map((v) => v.id)).toEqual(['v2', 'v3']);
  });

  it('rejects negative window', () => {
    expect(() => pendingChanges([], '2026-05-22', -1)).toThrow();
  });
});

describe('staleByDays', () => {
  it('returns null when current is within threshold', () => {
    const v = ver({ effectiveOn: '2026-01-01' });
    expect(staleByDays(v, '2026-05-22', 365)).toBeNull();
  });

  it('returns days over threshold when stale', () => {
    const v = ver({ effectiveOn: '2024-01-01' });
    const r = staleByDays(v, '2026-05-22', 365);
    expect(r).toBeGreaterThan(0);
  });

  it('returns null when current is null', () => {
    expect(staleByDays(null, '2026-05-22', 365)).toBeNull();
  });
});
