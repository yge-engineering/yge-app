import { describe, it, expect } from 'vitest';
import {
  JsaSchema,
  JsaCreateSchema,
  JsaPatchSchema,
  JSA_TEMPLATES,
  jsaTaskTypeLabel,
  hasHighSeverityHazard,
  uncontrolledHazardCount,
  newJsaId,
} from './jsa';

const baseValid = {
  id: 'jsa-12345678',
  createdAt: '2026-05-22T08:00:00Z',
  updatedAt: '2026-05-22T08:00:00Z',
  jobId: 'job-1',
  workDate: '2026-05-22',
  taskType: 'EXCAVATION' as const,
  taskDescription: '5 ft trench for storm pipe',
  preparedByName: 'Ryan Young',
  foremanSignedAt: '2026-05-22T07:00:00Z',
  hazards: [],
  crewSignatures: [],
  photoRefs: [],
};

describe('JsaSchema', () => {
  it('parses a valid record and applies defaults', () => {
    const j = JsaSchema.parse(baseValid);
    expect(j.taskType).toBe('EXCAVATION');
    expect(j.hazards).toEqual([]);
    expect(j.crewSignatures).toEqual([]);
  });
  it('rejects a bad workDate format', () => {
    expect(JsaSchema.safeParse({ ...baseValid, workDate: '5/22/2026' }).success).toBe(false);
  });
  it('rejects a bad startTime format', () => {
    expect(JsaSchema.safeParse({ ...baseValid, startTime: '7am' }).success).toBe(false);
  });
  it('accepts a valid startTime', () => {
    expect(JsaSchema.safeParse({ ...baseValid, startTime: '07:15' }).success).toBe(true);
  });
});

describe('JsaCreateSchema / JsaPatchSchema', () => {
  it('Create omits id and timestamps', () => {
    expect(
      JsaCreateSchema.parse({
        jobId: 'job-1',
        workDate: '2026-05-22',
        taskType: 'GRADING',
        taskDescription: 'Cut sub-grade',
        preparedByName: 'Ryan',
        foremanSignedAt: '2026-05-22T07:00:00Z',
      }).taskType,
    ).toBe('GRADING');
  });
  it('Patch accepts empty', () => {
    expect(JsaPatchSchema.safeParse({}).success).toBe(true);
  });
});

describe('hasHighSeverityHazard', () => {
  it('true with at least one HIGH or CRITICAL', () => {
    expect(
      hasHighSeverityHazard({
        hazards: [
          { description: 'a', controls: [], ppe: [], severity: 'LOW' },
          { description: 'b', controls: [], ppe: [], severity: 'HIGH' },
        ],
      }),
    ).toBe(true);
  });
  it('false with only LOW/MEDIUM', () => {
    expect(
      hasHighSeverityHazard({
        hazards: [
          { description: 'a', controls: [], ppe: [], severity: 'LOW' },
          { description: 'b', controls: [], ppe: [], severity: 'MEDIUM' },
        ],
      }),
    ).toBe(false);
  });
});

describe('uncontrolledHazardCount', () => {
  it('counts hazards with empty controls', () => {
    expect(
      uncontrolledHazardCount({
        hazards: [
          { description: 'a', controls: [], ppe: [], severity: 'LOW' },
          { description: 'b', controls: ['fix it'], ppe: [], severity: 'HIGH' },
          { description: 'c', controls: [], ppe: ['gloves'], severity: 'LOW' },
        ],
      }),
    ).toBe(2);
  });
});

describe('jsaTaskTypeLabel', () => {
  it('lowercases and replaces underscores', () => {
    expect(jsaTaskTypeLabel('TREE_FELLING')).toBe('tree felling');
    expect(jsaTaskTypeLabel('EXCAVATION')).toBe('excavation');
  });
});

describe('JSA_TEMPLATES', () => {
  it('has a template for every task type', () => {
    const types: Array<keyof typeof JSA_TEMPLATES> = [
      'EXCAVATION',
      'GRADING',
      'CONCRETE_PLACEMENT',
      'GUARDRAIL',
      'TREE_FELLING',
      'BRUSH_REMOVAL',
      'PRESCRIBED_BURN_PREP',
      'EQUIPMENT_OPERATION',
      'DUMP_TRUCK_HAUL',
      'TRAFFIC_CONTROL',
      'WORK_NEAR_WATER',
      'CONFINED_SPACE',
      'FALL_PROTECTION',
      'HOT_WORK',
      'DEMOLITION',
      'OTHER',
    ];
    for (const t of types) {
      expect(Array.isArray(JSA_TEMPLATES[t])).toBe(true);
    }
  });
  it('excavation template flags trench collapse as CRITICAL', () => {
    expect(JSA_TEMPLATES.EXCAVATION.some((h) => h.severity === 'CRITICAL')).toBe(true);
  });
  it('flagging / traffic control flags vehicle-strike as CRITICAL', () => {
    expect(JSA_TEMPLATES.TRAFFIC_CONTROL.some((h) => h.severity === 'CRITICAL')).toBe(true);
  });
});

describe('newJsaId', () => {
  it('matches the jsa-<8chars> pattern', () => {
    expect(newJsaId()).toMatch(/^jsa-[a-z0-9]{8}$/);
  });
});
