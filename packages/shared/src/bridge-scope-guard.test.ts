import { describe, it, expect } from 'vitest';

import { checkBridgeScope, type BridgeCheckInput } from './bridge-scope-guard';

function makeDraft(overrides: Partial<BridgeCheckInput>): BridgeCheckInput {
  return {
    projectName: 'Test',
    bidItems: [{ description: 'Mobilization' }],
    ...overrides,
  };
}

describe('checkBridgeScope', () => {
  it('returns false for unrelated drafts', () => {
    const d = makeDraft({ projectName: 'Mass grading' });
    expect(checkBridgeScope(d).isBridgeJob).toBe(false);
  });

  it('detects via projectType=BRIDGE', () => {
    const d = makeDraft({ projectType: 'BRIDGE' });
    expect(checkBridgeScope(d).isBridgeJob).toBe(true);
  });

  it('detects via "bridge" keyword', () => {
    const d = makeDraft({ projectName: 'Cottonwood Creek Bridge Replacement' });
    const r = checkBridgeScope(d);
    expect(r.isBridgeJob).toBe(true);
    expect(r.detectedKeywords).toContain('bridge');
  });

  it('flags rebar and falsework as missing when only mobilization', () => {
    const d = makeDraft({
      projectName: 'Bridge replacement',
      bidItems: [{ description: 'Mobilization' }],
    });
    const r = checkBridgeScope(d);
    expect(r.missingItems.map((i) => i.key)).toContain('rebar');
    expect(r.missingItems.map((i) => i.key)).toContain('falsework');
  });

  it('marks rebar present when described', () => {
    const d = makeDraft({
      projectName: 'Bridge deck replacement',
      bidItems: [
        { description: 'Reinforcing steel, epoxy-coated #5 bar' },
      ],
    });
    const r = checkBridgeScope(d);
    expect(r.presentItems.map((i) => i.key)).toContain('rebar');
  });

  it('marks complete bridge draft fully covered', () => {
    const d = makeDraft({
      projectName: 'Complete bridge replacement',
      bidItems: [
        { description: 'Existing bridge demo' },
        { description: 'Falsework + temporary shoring' },
        { description: 'Reinforcing steel #5 bar' },
        { description: 'Class A cast-in-place concrete deck' },
        { description: 'Modular joint seal' },
        { description: 'Type 7 bridge railing' },
        { description: 'Approach slab cast-in-place' },
        { description: 'Polymer overlay waterproofing' },
        { description: 'Elastomeric bearing pads' },
        { description: 'CIDH pile driving for piers' },
      ],
    });
    const r = checkBridgeScope(d);
    expect(r.isBridgeJob).toBe(true);
    expect(r.missingItems).toEqual([]);
    expect(r.presentItems.length).toBe(10);
  });
});
