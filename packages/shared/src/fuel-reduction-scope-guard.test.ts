import { describe, it, expect } from 'vitest';

import {
  checkFuelReductionScope,
  type FuelReductionCheckInput,
} from './fuel-reduction-scope-guard';

function makeDraft(overrides: Partial<FuelReductionCheckInput>): FuelReductionCheckInput {
  return {
    projectName: 'Test',
    bidItems: [{ description: 'Mobilization' }],
    ...overrides,
  };
}

describe('checkFuelReductionScope', () => {
  it('returns false for unrelated drafts', () => {
    const d = makeDraft({ projectName: 'Road overlay' });
    expect(checkFuelReductionScope(d).isFuelReductionJob).toBe(false);
  });

  it('detects via projectType=FIRE_FUEL_REDUCTION', () => {
    const d = makeDraft({ projectType: 'FIRE_FUEL_REDUCTION' });
    expect(checkFuelReductionScope(d).isFuelReductionJob).toBe(true);
  });

  it('detects via "mastication" keyword', () => {
    const d = makeDraft({ projectName: 'McCloud Mastication Project' });
    const r = checkFuelReductionScope(d);
    expect(r.isFuelReductionJob).toBe(true);
    expect(r.detectedKeywords).toContain('mastication');
  });

  it('detects via "CAL FIRE" agency keyword', () => {
    const d = makeDraft({
      projectName: 'Sulphur Springs Treatment',
      ownerAgency: 'CAL FIRE',
    });
    expect(checkFuelReductionScope(d).isFuelReductionJob).toBe(true);
  });

  it('flags slash treatment + burn piles missing when only mobilization', () => {
    const d = makeDraft({
      projectName: 'CAL FIRE mastication',
      bidItems: [{ description: 'Mobilization' }],
    });
    const r = checkFuelReductionScope(d);
    expect(r.missingItems.map((i) => i.key)).toContain('slash-treatment');
    expect(r.missingItems.map((i) => i.key)).toContain('burn-piles');
    expect(r.missingItems.map((i) => i.key)).toContain('resource-avoidance');
  });

  it('marks burn piles present when described', () => {
    const d = makeDraft({
      projectName: 'CAL FIRE fuel reduction',
      bidItems: [
        { description: 'Pile burn + 20-day burn monitoring' },
      ],
    });
    const r = checkFuelReductionScope(d);
    expect(r.presentItems.map((i) => i.key)).toContain('burn-piles');
  });

  it('marks complete fuel-reduction draft as fully covered', () => {
    const d = makeDraft({
      projectName: 'Complete fuel reduction',
      bidItems: [
        { description: 'Hand pile slash' },
        { description: 'Pile burn + 20 day monitor' },
        { description: 'Green waste haul to landfill' },
        { description: 'Shaded fuel break, 300 ft wide' },
        { description: 'Native hydroseed mix' },
        { description: 'Straw waddle erosion control' },
        { description: 'Biological monitor + nest survey' },
        { description: 'Temporary access road + turnout' },
      ],
    });
    const r = checkFuelReductionScope(d);
    expect(r.isFuelReductionJob).toBe(true);
    expect(r.missingItems).toEqual([]);
    expect(r.presentItems.length).toBe(8);
  });
});
