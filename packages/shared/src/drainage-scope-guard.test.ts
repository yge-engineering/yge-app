import { describe, it, expect } from 'vitest';

import { checkDrainageScope, type DrainageCheckInput } from './drainage-scope-guard';

function makeDraft(overrides: Partial<DrainageCheckInput>): DrainageCheckInput {
  return {
    projectName: 'Test',
    bidItems: [{ description: 'Mobilization' }],
    ...overrides,
  };
}

describe('checkDrainageScope', () => {
  it('returns isDrainageJob:false for non-drainage drafts', () => {
    const d = makeDraft({ projectName: 'Road overlay' });
    const r = checkDrainageScope(d);
    expect(r.isDrainageJob).toBe(false);
  });

  it('detects via projectType=DRAINAGE', () => {
    const d = makeDraft({ projectType: 'DRAINAGE' });
    expect(checkDrainageScope(d).isDrainageJob).toBe(true);
  });

  it('detects via "storm drain" multi-word keyword', () => {
    const d = makeDraft({ projectName: 'County Road 8 storm drain replacement' });
    const r = checkDrainageScope(d);
    expect(r.isDrainageJob).toBe(true);
    expect(r.detectedKeywords).toContain('storm drain');
  });

  it('detects via "culvert" keyword', () => {
    const d = makeDraft({ projectName: 'Big Bear Culvert Extension' });
    const r = checkDrainageScope(d);
    expect(r.isDrainageJob).toBe(true);
    expect(r.detectedKeywords).toContain('culvert');
  });

  it('flags bedding and energy dissipator as missing when only pipe listed', () => {
    const d = makeDraft({
      projectName: 'Storm drain repair',
      bidItems: [
        { description: '36" RCP pipe install' },
      ],
    });
    const r = checkDrainageScope(d);
    expect(r.missingItems.map((i) => i.key)).toContain('pipe-bedding');
    expect(r.missingItems.map((i) => i.key)).toContain('riprap-energy-dissipator');
  });

  it('marks pipe bedding present when described', () => {
    const d = makeDraft({
      projectName: 'Drainage repair',
      bidItems: [
        { description: 'Pipe bedding, Class 2 AB' },
      ],
    });
    const r = checkDrainageScope(d);
    expect(r.presentItems.map((i) => i.key)).toContain('pipe-bedding');
  });

  it('marks complete drainage draft fully covered', () => {
    const d = makeDraft({
      projectName: 'Complete culvert replacement',
      bidItems: [
        { description: '36" RCP pipe' },
        { description: 'Pipe bedding Class 2 AB' },
        { description: 'Trench excavation' },
        { description: 'Trench backfill compacted' },
        { description: 'Cast-in-place headwall, both ends' },
        { description: 'Class A riprap energy dissipator' },
        { description: 'Curb inlet structure' },
        { description: 'Drainage manhole' },
        { description: 'SWPPP BMP fiber roll' },
        { description: 'Slope paving below outlet' },
        { description: 'USA pothole utility conflicts' },
      ],
    });
    const r = checkDrainageScope(d);
    expect(r.isDrainageJob).toBe(true);
    expect(r.missingItems).toEqual([]);
    expect(r.presentItems.length).toBe(10);
  });
});
