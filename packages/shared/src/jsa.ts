// JSA — Job Safety Analysis.
//
// A foreman opens a fillable JSA on his phone at the start of a shift. He
// picks the task type, the app pre-loads typical hazards + controls + PPE
// for that task, he adds anything site-specific, the crew signs (one tap
// per name), and he signs at the bottom. The form auto-uploads when it's
// got signal.
//
// What this catches that paper logs miss:
//   - 'Did anyone do a JSA before the crew started on the new culvert?'
//   - 'Which crew members signed the JSA on the day Mike got hurt?'
//   - 'Are we consistently calling out fall protection on hot work?'

import { z } from 'zod';

/** Common task types YGE runs — drives the pre-built hazard templates. */
export const JsaTaskTypeSchema = z.enum([
  'EXCAVATION',         // by depth: <5ft, 5–20ft, >20ft
  'GRADING',
  'CONCRETE_PLACEMENT',
  'GUARDRAIL',
  'TREE_FELLING',
  'BRUSH_REMOVAL',
  'PRESCRIBED_BURN_PREP',
  'EQUIPMENT_OPERATION', // dozer, excavator, loader, skid steer, backhoe
  'DUMP_TRUCK_HAUL',
  'TRAFFIC_CONTROL',
  'WORK_NEAR_WATER',
  'CONFINED_SPACE',
  'FALL_PROTECTION',
  'HOT_WORK',
  'DEMOLITION',
  'OTHER',
]);
export type JsaTaskType = z.infer<typeof JsaTaskTypeSchema>;

export const JsaHazardSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type JsaHazardSeverity = z.infer<typeof JsaHazardSeveritySchema>;

export const JsaHazardSchema = z.object({
  description: z.string().min(1).max(500),
  /** What we do about it — engineering / admin / PPE controls. */
  controls: z.array(z.string().min(1).max(300)).default([]),
  /** PPE required — gloves, hardhat, harness, respirator, etc. */
  ppe: z.array(z.string().min(1).max(120)).default([]),
  severity: JsaHazardSeveritySchema.default('MEDIUM'),
});
export type JsaHazard = z.infer<typeof JsaHazardSchema>;

/** A crew member's sign-off on the JSA. */
export const JsaSignatureSchema = z.object({
  employeeId: z.string().max(60).optional(),
  employeeName: z.string().min(1).max(120),
  /** ISO timestamp when signed. */
  signedAt: z.string().min(1),
});
export type JsaSignature = z.infer<typeof JsaSignatureSchema>;

export const JsaSchema = z.object({
  /** Stable id `jsa-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Date of work (yyyy-mm-dd). */
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Optional time of day (HH:MM). */
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),

  taskType: JsaTaskTypeSchema,
  /** Free-form description of the specific work being done today. */
  taskDescription: z.string().min(1).max(2_000),
  /** Quick weather note (sunny, overcast, rain, wind, etc.). */
  weather: z.string().max(200).optional(),
  /** Site-specific conditions — slope, traffic, neighbors, etc. */
  siteConditions: z.string().max(2_000).optional(),

  /** The hazards identified for this task today. */
  hazards: z.array(JsaHazardSchema).default([]),

  /** Foreman who prepared the JSA. */
  preparedByEmployeeId: z.string().max(60).optional(),
  preparedByName: z.string().min(1).max(120),
  /** Foreman signature timestamp (the act of submitting). */
  foremanSignedAt: z.string().min(1),

  /** Each crew member who was on site at start of shift signs. */
  crewSignatures: z.array(JsaSignatureSchema).default([]),

  /** Optional photo references (object keys / URLs). */
  photoRefs: z.array(z.string().max(800)).default([]),

  notes: z.string().max(10_000).optional(),
});
export type Jsa = z.infer<typeof JsaSchema>;

export const JsaCreateSchema = JsaSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  hazards: z.array(JsaHazardSchema).optional(),
  crewSignatures: z.array(JsaSignatureSchema).optional(),
  photoRefs: z.array(z.string().max(800)).optional(),
});
export type JsaCreate = z.infer<typeof JsaCreateSchema>;

export const JsaPatchSchema = JsaCreateSchema.partial();
export type JsaPatch = z.infer<typeof JsaPatchSchema>;

/** Short id generator — matches the project's `<prefix>-<8hex>` pattern. */
export function newJsaId(): string {
  return 'jsa-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

/** Friendly label for a task type. */
export function jsaTaskTypeLabel(t: JsaTaskType): string {
  return t.replace(/_/g, ' ').toLowerCase();
}

/** True if any hazard is HIGH or CRITICAL — used to gate submit on the phone
 *  if PPE isn't logged. */
export function hasHighSeverityHazard(jsa: Pick<Jsa, 'hazards'>): boolean {
  return jsa.hazards.some((h) => h.severity === 'HIGH' || h.severity === 'CRITICAL');
}

/** Count of hazards that don't yet have any control. Useful red-flag. */
export function uncontrolledHazardCount(jsa: Pick<Jsa, 'hazards'>): number {
  return jsa.hazards.filter((h) => h.controls.length === 0).length;
}

/** Pre-built starter hazard templates per task type. Stored here (not in the
 *  DB) so the data is version-controlled with the code. Foremen edit before
 *  signing. */
export const JSA_TEMPLATES: Record<JsaTaskType, JsaHazard[]> = {
  EXCAVATION: [
    {
      description: 'Trench collapse / cave-in (engulfment)',
      controls: ['Sloping per CalOSHA Type A/B/C', 'Shoring if > 5 ft', 'Daily competent-person inspection'],
      ppe: ['Hard hat', 'Hi-vis vest'],
      severity: 'CRITICAL',
    },
    {
      description: 'Underground utility strike',
      controls: ['USA dig-alert ticket called and active', 'Hand-dig within 2 ft of marked utility', 'Pothole if uncertain'],
      ppe: ['Gloves'],
      severity: 'HIGH',
    },
    {
      description: 'Fall into trench',
      controls: ['Barricade / fence', 'Cover unattended excavations'],
      ppe: ['Hi-vis vest'],
      severity: 'MEDIUM',
    },
  ],
  GRADING: [
    {
      description: 'Equipment strike (operator blind spots)',
      controls: ['Spotter when ground crew within swing radius', 'Eye contact before approach'],
      ppe: ['Hi-vis vest', 'Hard hat'],
      severity: 'HIGH',
    },
    {
      description: 'Slope instability',
      controls: ['Survey before working below cut slope', 'No work below loose material'],
      ppe: ['Hard hat'],
      severity: 'MEDIUM',
    },
  ],
  CONCRETE_PLACEMENT: [
    {
      description: 'Concrete burn (skin contact)',
      controls: ['Wash exposed skin immediately', 'No skin-tight clothing'],
      ppe: ['Rubber boots', 'Chemical gloves', 'Long sleeves'],
      severity: 'MEDIUM',
    },
    {
      description: 'Pump-line whip / hose failure',
      controls: ['Inspect couplers', 'Clear blockages from upstream'],
      ppe: ['Face shield'],
      severity: 'HIGH',
    },
  ],
  GUARDRAIL: [
    {
      description: 'Adjacent traffic',
      controls: ['Traffic-control plan in place', 'Signage upstream'],
      ppe: ['Hi-vis Class 3 vest'],
      severity: 'HIGH',
    },
    {
      description: 'Driven post recoil',
      controls: ['Clear strike zone before each post'],
      ppe: ['Hard hat', 'Safety glasses'],
      severity: 'MEDIUM',
    },
  ],
  TREE_FELLING: [
    {
      description: 'Felled tree hit (escape route blocked)',
      controls: ['Pre-cut escape route at 45° from fall line', 'Two-person team minimum'],
      ppe: ['Chainsaw chaps', 'Hard hat with face shield', 'Hearing protection'],
      severity: 'CRITICAL',
    },
    {
      description: 'Chainsaw kickback',
      controls: ['Chain tension checked', 'No bar-tip cuts'],
      ppe: ['Cut-resistant gloves'],
      severity: 'HIGH',
    },
  ],
  BRUSH_REMOVAL: [
    {
      description: 'Heat illness',
      controls: ['Shade', 'Water every 20 min', '5-min rest period each hour above 95°F'],
      ppe: ['Hat with brim', 'Long sleeves'],
      severity: 'HIGH',
    },
    {
      description: 'Poison oak exposure',
      controls: ['ID before contact', 'Wash exposed skin'],
      ppe: ['Long sleeves', 'Gloves'],
      severity: 'LOW',
    },
  ],
  PRESCRIBED_BURN_PREP: [
    {
      description: 'Spot fire ignition',
      controls: ['Charged water lines on site', 'Wind check before ignition'],
      ppe: ['Nomex coveralls', 'Leather boots'],
      severity: 'CRITICAL',
    },
  ],
  EQUIPMENT_OPERATION: [
    {
      description: 'Rollover',
      controls: ['ROPS in place', 'Seatbelt worn', 'Stay off slopes > equipment rating'],
      ppe: ['Seatbelt'],
      severity: 'HIGH',
    },
    {
      description: 'Pinch points (boom / bucket / track)',
      controls: ['Crew outside swing radius', 'Visual / radio contact'],
      ppe: ['Hard hat'],
      severity: 'HIGH',
    },
  ],
  DUMP_TRUCK_HAUL: [
    {
      description: 'Backing accidents',
      controls: ['Spotter required', 'Backup alarm operational'],
      ppe: ['Hi-vis vest'],
      severity: 'HIGH',
    },
    {
      description: 'Overhead power lines',
      controls: ['Bed up only in designated areas', 'Minimum 10 ft clearance'],
      ppe: [],
      severity: 'CRITICAL',
    },
  ],
  TRAFFIC_CONTROL: [
    {
      description: 'Vehicle strike of flagger',
      controls: ['Class 3 hi-vis required', 'STOP/SLOW paddle, no hand signals', 'Buffer space between work zone and traffic'],
      ppe: ['Class 3 vest', 'Hard hat'],
      severity: 'CRITICAL',
    },
  ],
  WORK_NEAR_WATER: [
    {
      description: 'Drowning',
      controls: ['PFD when within 6 ft of water', 'Rescue throw rope on bank'],
      ppe: ['PFD'],
      severity: 'CRITICAL',
    },
  ],
  CONFINED_SPACE: [
    {
      description: 'Atmospheric hazard',
      controls: ['Pre-entry gas test (O2, LEL, CO, H2S)', 'Continuous monitoring during entry', 'Attendant outside at all times'],
      ppe: ['SCBA if IDLH', 'Harness with retrieval line'],
      severity: 'CRITICAL',
    },
  ],
  FALL_PROTECTION: [
    {
      description: 'Fall from height > 6 ft',
      controls: ['Anchor point rated 5,000 lb', 'Self-retracting lifeline or shock-absorbing lanyard', 'Rescue plan in place'],
      ppe: ['Full-body harness', 'Hard hat'],
      severity: 'CRITICAL',
    },
  ],
  HOT_WORK: [
    {
      description: 'Fire ignition (sparks / molten metal)',
      controls: ['Hot-work permit signed', 'Fire watch 30 min after work', 'Combustibles cleared 35 ft'],
      ppe: ['Welding hood', 'Leather sleeves', 'Fire-resistant pants'],
      severity: 'HIGH',
    },
  ],
  DEMOLITION: [
    {
      description: 'Unplanned collapse',
      controls: ['Engineering survey before start', 'Sequence top-down'],
      ppe: ['Hard hat', 'Safety glasses'],
      severity: 'HIGH',
    },
  ],
  OTHER: [],
};
