import { describe, it, expect } from 'vitest';

import { checkRoadReconScope, type RoadReconCheckInput } from './road-recon-scope-guard';

function makeDraft(overrides: Partial<RoadReconCheckInput>): RoadReconCheckInput {
  return {
    projectName: 'Test Project',
    bidItems: [{ description: 'Mobilization' }],
    ...overrides,
  };
}

describe('checkRoadReconScope', () => {
  it('returns isRoadJob:false for a non-road draft', () => {
    const draft = makeDraft({ projectName: 'Powerline Substation Upgrades' });
    const result = checkRoadReconScope(draft);
    expect(result.isRoadJob).toBe(false);
    expect(result.missingItems).toEqual([]);
  });

  it('detects via projectType=ROAD_RECONSTRUCTION even without keywords', () => {
    const draft = makeDraft({
      projectName: 'Misc Civil Work',
      projectType: 'ROAD_RECONSTRUCTION',
    });
    const result = checkRoadReconScope(draft);
    expect(result.isRoadJob).toBe(true);
    expect(result.detectedKeywords).toContain('projectType:ROAD_RECONSTRUCTION');
  });

  it('detects via "overlay" keyword in projectName', () => {
    const draft = makeDraft({
      projectName: 'Sulphur Springs Road Overlay',
    });
    const result = checkRoadReconScope(draft);
    expect(result.isRoadJob).toBe(true);
    expect(result.detectedKeywords).toContain('overlay');
  });

  it('detects via "mill and overlay" multi-word match', () => {
    const draft = makeDraft({
      projectName: 'County Road 8 mill and overlay',
    });
    const result = checkRoadReconScope(draft);
    expect(result.isRoadJob).toBe(true);
    expect(result.detectedKeywords).toContain('mill and overlay');
  });

  it('flags ADA ramps as missing when only mobilization listed', () => {
    const draft = makeDraft({
      projectName: 'Road overlay project',
      bidItems: [{ description: 'Mobilization' }],
    });
    const result = checkRoadReconScope(draft);
    expect(result.isRoadJob).toBe(true);
    expect(result.missingItems.map((i) => i.key)).toContain('ada-curb-ramps');
    expect(result.missingItems.map((i) => i.key)).toContain('traffic-control');
  });

  it('marks ADA ramps present when listed in any description', () => {
    const draft = makeDraft({
      projectName: 'Road overlay project',
      bidItems: [
        { description: 'Mobilization' },
        { description: 'ADA curb ramp per Caltrans A88A' },
      ],
    });
    const result = checkRoadReconScope(draft);
    expect(result.presentItems.map((i) => i.key)).toContain('ada-curb-ramps');
    expect(result.missingItems.map((i) => i.key)).not.toContain('ada-curb-ramps');
  });

  it('marks complete road draft as fully covered', () => {
    const draft = makeDraft({
      projectName: 'Complete road rebuild',
      bidItems: [
        { description: 'Mobilization' },
        { description: 'ADA curb ramp, detectable warning' },
        { description: 'Traffic control plan + flagger' },
        { description: 'Thermoplastic striping (4" white)' },
        { description: 'Stop sign install' },
        { description: 'SWPPP BMPs (fiber roll, inlet protection)' },
        { description: 'Subgrade scarify + recompact' },
        { description: 'Class 2 aggregate base, 6"' },
        { description: 'HMA Type A overlay, 3" lift' },
        { description: 'Tack coat asphalt emulsion' },
        { description: 'Sawcut existing pavement + cold plane' },
      ],
    });
    const result = checkRoadReconScope(draft);
    expect(result.isRoadJob).toBe(true);
    expect(result.missingItems).toEqual([]);
    expect(result.presentItems.length).toBe(10);
  });
});
