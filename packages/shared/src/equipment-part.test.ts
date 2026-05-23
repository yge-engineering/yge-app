import { describe, it, expect } from 'vitest';
import {
  EquipmentPartInventorySchema,
  EquipmentPartSchema,
  classifyPart,
  isBelowPar,
  reorderList,
  type EquipmentPart,
  type EquipmentPartInventory,
} from './equipment-part';

describe('EquipmentPartSchema', () => {
  it('parses with default unit of measure', () => {
    const p = EquipmentPartSchema.parse({
      id: 'p1',
      description: 'CAT 1R-0750 oil filter',
      category: 'FILTER_OIL',
    });
    expect(p.unitOfMeasure).toBe('EA');
    expect(p.fitsEquipmentIds).toEqual([]);
  });
});

describe('classifyPart — filters', () => {
  it('detects oil filter ahead of FLUID_ENGINE_OIL', () => {
    expect(classifyPart('CAT 1R-0750 oil filter')).toBe('FILTER_OIL');
    expect(classifyPart('spin-on oil filter')).toBe('FILTER_OIL');
  });

  it('detects air filter', () => {
    expect(classifyPart('Donaldson P181135 air filter')).toBe('FILTER_AIR');
  });

  it('detects fuel filter + water separator', () => {
    expect(classifyPart('fuel/water separator')).toBe('FILTER_FUEL');
  });

  it('detects hydraulic filter', () => {
    expect(classifyPart('hyd filter, return-line')).toBe('FILTER_HYDRAULIC');
  });

  it('detects cabin/HVAC filter', () => {
    expect(classifyPart('cabin filter')).toBe('FILTER_CABIN');
    expect(classifyPart('HVAC filter')).toBe('FILTER_CABIN');
  });
});

describe('classifyPart — fluids', () => {
  it('classifies 15W40 engine oil', () => {
    expect(classifyPart('Rotella 15W40, 1 qt')).toBe('FLUID_ENGINE_OIL');
  });

  it('classifies AW-46 hydraulic oil', () => {
    expect(classifyPart('Chevron AW46 hydraulic oil, 5 gal')).toBe('FLUID_HYDRAULIC');
  });

  it('classifies coolant / antifreeze', () => {
    expect(classifyPart('antifreeze EG-50 (1 gal)')).toBe('FLUID_COOLANT');
  });

  it('classifies grease', () => {
    expect(classifyPart('moly grease EP-2')).toBe('FLUID_GREASE');
  });

  it('classifies DEF', () => {
    expect(classifyPart('Diesel Exhaust Fluid 2.5 gal')).toBe('FLUID_DEF');
  });

  it('classifies transmission fluid + final-drive oil', () => {
    expect(classifyPart('Caterpillar ATF (5 gal)')).toBe('FLUID_TRANSMISSION');
    expect(classifyPart('Final drive oil, 30 wt')).toBe('FLUID_TRANSMISSION');
  });
});

describe('classifyPart — belts, hoses, electrical, GET', () => {
  it('belts', () => {
    expect(classifyPart('drive belt')).toBe('BELT_DRIVE');
    expect(classifyPart('timing belt kit')).toBe('BELT_TIMING');
  });
  it('hoses', () => {
    expect(classifyPart('hydraulic hose 1/2 x 60"')).toBe('HOSE_HYDRAULIC');
    expect(classifyPart('upper radiator hose')).toBe('HOSE_RADIATOR');
    expect(classifyPart('fuel line, 3/8 in')).toBe('HOSE_FUEL');
  });
  it('electrical', () => {
    expect(classifyPart('Group 31 battery, 1000 CCA')).toBe('ELECTRICAL_BATTERY');
    expect(classifyPart('LED work light bulb')).toBe('ELECTRICAL_BULB');
    expect(classifyPart('relay, 12V')).toBe('ELECTRICAL_SWITCH');
  });
  it('GET — teeth, edges, pins, pads', () => {
    expect(classifyPart('bucket tooth, K-series')).toBe('GET_TEETH');
    expect(classifyPart('cutting edge, 8 ft')).toBe('GET_CUTTING_EDGE');
    expect(classifyPart('pin kit, bucket')).toBe('GET_BUSHING_PIN');
    expect(classifyPart('track pad, rubber')).toBe('GET_TRACK_PAD');
  });
});

describe('classifyPart — fallthrough', () => {
  it('returns OTHER when nothing matches', () => {
    expect(classifyPart('mystery widget part')).toBe('OTHER');
  });

  it('uses manufacturer + description together', () => {
    // Description alone doesn't say "filter"; manufacturer + part-number-only
    // → falls through to OTHER. Real AI would catch this.
    expect(classifyPart('1R-0750', 'Caterpillar')).toBe('OTHER');
  });

  it('matches a bolt as a fastener', () => {
    expect(classifyPart('M16 cap screw, 50mm')).toBe('FASTENER');
  });
});

describe('isBelowPar', () => {
  it('true when on-hand at par', () => {
    expect(isBelowPar({ parLevel: 5 }, { onHandQty: 5 })).toBe(true);
  });
  it('true when on-hand under par', () => {
    expect(isBelowPar({ parLevel: 5 }, { onHandQty: 2 })).toBe(true);
  });
  it('false when on-hand above par', () => {
    expect(isBelowPar({ parLevel: 5 }, { onHandQty: 8 })).toBe(false);
  });
  it('false when parLevel undefined', () => {
    expect(isBelowPar({}, { onHandQty: 0 })).toBe(false);
  });
});

describe('reorderList', () => {
  const parts: EquipmentPart[] = [
    EquipmentPartSchema.parse({
      id: 'p1',
      description: 'CAT oil filter',
      category: 'FILTER_OIL',
      parLevel: 6,
    }),
    EquipmentPartSchema.parse({
      id: 'p2',
      description: 'Hyd hose',
      category: 'HOSE_HYDRAULIC',
      parLevel: 2,
    }),
    EquipmentPartSchema.parse({
      id: 'p3',
      description: 'Grease tube',
      category: 'FLUID_GREASE',
      parLevel: 4,
    }),
  ];

  it('returns only below-par rows sorted by most urgent', () => {
    const invs: EquipmentPartInventory[] = [
      EquipmentPartInventorySchema.parse({
        partId: 'p1',
        locationId: 'yard',
        onHandQty: 1,
        asOfDate: '2026-05-22',
      }), // short by 5
      EquipmentPartInventorySchema.parse({
        partId: 'p2',
        locationId: 'yard',
        onHandQty: 10,
        asOfDate: '2026-05-22',
      }), // above par — excluded
      EquipmentPartInventorySchema.parse({
        partId: 'p3',
        locationId: 'yard',
        onHandQty: 3,
        asOfDate: '2026-05-22',
      }), // short by 1
    ];
    const list = reorderList(parts, invs);
    expect(list.map((r) => r.part.id)).toEqual(['p1', 'p3']);
    expect(list[0]!.shortBy).toBe(5);
    expect(list[1]!.shortBy).toBe(1);
  });

  it('ignores inventory rows whose partId is unknown', () => {
    const orphan: EquipmentPartInventory[] = [
      EquipmentPartInventorySchema.parse({
        partId: 'mystery',
        locationId: 'yard',
        onHandQty: 0,
        asOfDate: '2026-05-22',
      }),
    ];
    expect(reorderList(parts, orphan)).toEqual([]);
  });
});
