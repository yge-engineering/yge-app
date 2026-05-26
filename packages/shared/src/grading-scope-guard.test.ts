import { describe, it, expect } from 'vitest';

import { checkGradingScope, type GradingCheckInput } from './grading-scope-guard';

function makeDraft(overrides: Partial<GradingCheckInput>): GradingCheckInput {
  return {
    projectName: 'Test',
    bidItems: [{ description: 'Mobilization' }],
    ...overrides,
  };
}

describe('checkGradingScope', () => {
  it('returns false for unrelated drafts', () => {
    const d = makeDraft({ projectName: 'CAL FIRE mastication' });
    expect(checkGradingScope(d).isGradingJob).toBe(false);
  });

  it('detects via projectType=GRADING', () => {
    const d = makeDraft({ projectType: 'GRADING' });
    expect(checkGradingScope(d).isGradingJob).toBe(true);
  });

  it('detects via "mass grading" keyword', () => {
    const d = makeDraft({ projectName: 'Anderson Pad Mass Grading' });
    const r = checkGradingScope(d);
    expect(r.isGradingJob).toBe(true);
    expect(r.detectedKeywords).toContain('mass grading');
  });

  it('detects via "building pad" keyword', () => {
    const d = makeDraft({ projectName: 'Cottonwood building pad prep' });
    const r = checkGradingScope(d);
    expect(r.isGradingJob).toBe(true);
    expect(r.detectedKeywords).toContain('building pad');
  });

  it('flags clearing, dust, SWPPP missing when only mobilization', () => {
    const d = makeDraft({
      projectName: 'Mass grading',
      bidItems: [{ description: 'Mobilization' }],
    });
    const r = checkGradingScope(d);
    expect(r.missingItems.map((i) => i.key)).toContain('clearing-grubbing');
    expect(r.missingItems.map((i) => i.key)).toContain('dust-control');
    expect(r.missingItems.map((i) => i.key)).toContain('erosion-swppp');
  });

  it('marks dust control present when described', () => {
    const d = makeDraft({
      projectName: 'Site grading',
      bidItems: [{ description: 'Water truck for dust control, daily' }],
    });
    const r = checkGradingScope(d);
    expect(r.presentItems.map((i) => i.key)).toContain('dust-control');
  });

  it('marks complete grading draft as fully covered', () => {
    const d = makeDraft({
      projectName: 'Complete site grading',
      bidItems: [
        { description: 'Clearing and grubbing' },
        { description: 'Strip topsoil + stockpile' },
        { description: 'Mass excavation cut to waste' },
        { description: 'Import fill from borrow source' },
        { description: 'Compaction to 95% relative density' },
        { description: 'Subgrade preparation, scarify 12"' },
        { description: 'Erosion control fiber roll' },
        { description: 'Water truck dust control' },
        { description: 'Demo existing building slab' },
        { description: 'Construction surveyor + slope stakes' },
      ],
    });
    const r = checkGradingScope(d);
    expect(r.isGradingJob).toBe(true);
    expect(r.missingItems).toEqual([]);
    expect(r.presentItems.length).toBe(10);
  });
});
