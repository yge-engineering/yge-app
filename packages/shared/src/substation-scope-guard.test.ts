import { describe, it, expect } from 'vitest';

import {
  checkSubstationCivilScope,
} from './substation-scope-guard';
import type { PtoEOutput } from './plans-to-estimate-output';

function makeDraft(overrides: Partial<PtoEOutput>): PtoEOutput {
  return {
    projectName: 'Test Project',
    projectType: 'OTHER',
    bidItems: [
      {
        itemNumber: '1',
        description: 'Mobilization',
        unit: 'LS',
        quantity: 1,
        confidence: 'HIGH',
      },
    ],
    overallConfidence: 'MEDIUM',
    ...overrides,
  } as PtoEOutput;
}

describe('checkSubstationCivilScope', () => {
  it('returns isSubstationJob:false for a non-substation draft', () => {
    const draft = makeDraft({
      projectName: 'Sulphur Springs Road Reconstruction',
      bidItems: [
        {
          itemNumber: '1',
          description: 'Aggregate base, Class 2',
          unit: 'TON',
          quantity: 1200,
          confidence: 'HIGH',
        },
      ],
    });
    const result = checkSubstationCivilScope(draft);
    expect(result.isSubstationJob).toBe(false);
    expect(result.missingItems).toEqual([]);
    expect(result.detectedKeywords).toEqual([]);
  });

  it('detects substation jobs from projectName', () => {
    const draft = makeDraft({
      projectName: 'Powerline Substation Upgrades',
    });
    const result = checkSubstationCivilScope(draft);
    expect(result.isSubstationJob).toBe(true);
    expect(result.detectedKeywords).toContain('substation');
  });

  it('detects substation jobs from ownerAgency', () => {
    const draft = makeDraft({
      ownerAgency: 'SMUD',
      projectName: 'Allbaugh Civil Improvements',
    });
    const result = checkSubstationCivilScope(draft);
    expect(result.isSubstationJob).toBe(true);
    expect(result.detectedKeywords).toContain('smud');
  });

  it('flags all required items as missing when only mobilization is listed', () => {
    const draft = makeDraft({
      projectName: 'SMUD Substation',
      bidItems: [
        {
          itemNumber: '1',
          description: 'Mobilization',
          unit: 'LS',
          quantity: 1,
          confidence: 'HIGH',
        },
      ],
    });
    const result = checkSubstationCivilScope(draft);
    expect(result.isSubstationJob).toBe(true);
    expect(result.missingItems.length).toBeGreaterThan(10);
    expect(result.missingItems.map((i) => i.key)).toContain('transformer-foundation');
    expect(result.missingItems.map((i) => i.key)).toContain('oil-containment');
    expect(result.presentItems).toEqual([]);
  });

  it('marks transformer-foundation present when listed', () => {
    const draft = makeDraft({
      projectName: 'Test Substation',
      bidItems: [
        {
          itemNumber: '1',
          description: 'Transformer foundation, cast-in-place per detail F-101',
          unit: 'EA',
          quantity: 2,
          confidence: 'HIGH',
        },
      ],
    });
    const result = checkSubstationCivilScope(draft);
    expect(result.isSubstationJob).toBe(true);
    const presentKeys = result.presentItems.map((i) => i.key);
    expect(presentKeys).toContain('transformer-foundation');
    expect(result.missingItems.map((i) => i.key)).not.toContain(
      'transformer-foundation',
    );
  });

  it('marks all 12 items present when the draft is complete', () => {
    const draft = makeDraft({
      projectName: 'Complete Substation Build',
      bidItems: [
        { itemNumber: '1', description: 'Mobilization', unit: 'LS', quantity: 1, confidence: 'HIGH' },
        { itemNumber: '2', description: 'Transformer foundation', unit: 'EA', quantity: 2, confidence: 'HIGH' },
        { itemNumber: '3', description: 'Switchgear pad', unit: 'EA', quantity: 4, confidence: 'HIGH' },
        { itemNumber: '4', description: 'Concrete-encased duct bank', unit: 'LF', quantity: 800, confidence: 'HIGH' },
        { itemNumber: '5', description: 'Pull box', unit: 'EA', quantity: 12, confidence: 'HIGH' },
        { itemNumber: '6', description: 'Ground grid bare copper trench', unit: 'LF', quantity: 1500, confidence: 'HIGH' },
        { itemNumber: '7', description: 'Oil containment berm + HDPE liner', unit: 'SF', quantity: 600, confidence: 'HIGH' },
        { itemNumber: '8', description: 'Chain link perimeter fence', unit: 'LF', quantity: 800, confidence: 'HIGH' },
        { itemNumber: '9', description: 'Yard rock Class 2 AB, 6" depth', unit: 'SF', quantity: 18000, confidence: 'HIGH' },
        { itemNumber: '10', description: 'SCADA control conduit trench', unit: 'LF', quantity: 500, confidence: 'HIGH' },
        { itemNumber: '11', description: 'CMU control building', unit: 'EA', quantity: 1, confidence: 'HIGH' },
        { itemNumber: '12', description: 'Yard light pole base', unit: 'EA', quantity: 6, confidence: 'HIGH' },
        { itemNumber: '13', description: 'Spill berm', unit: 'LF', quantity: 200, confidence: 'HIGH' },
      ],
    });
    const result = checkSubstationCivilScope(draft);
    expect(result.isSubstationJob).toBe(true);
    expect(result.missingItems).toEqual([]);
    expect(result.presentItems.length).toBe(12);
  });

  it('scans bid-item descriptions for substation-trigger keywords too', () => {
    const draft = makeDraft({
      projectName: 'Misc Civil Work',
      bidItems: [
        {
          itemNumber: '1',
          description: 'Excavate trench for ground grid',
          unit: 'LF',
          quantity: 200,
          confidence: 'MEDIUM',
        },
      ],
    });
    const result = checkSubstationCivilScope(draft);
    expect(result.isSubstationJob).toBe(true);
    // Detected via "ground grid" keyword.
    expect(result.detectedKeywords).toContain('ground grid');
  });
});
