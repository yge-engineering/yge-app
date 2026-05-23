// Equipment service record (a work order).

import { z } from 'zod';

export const ServiceRecordStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'CLOSED',
  'CANCELLED',
]);
export type ServiceRecordStatus = z.infer<typeof ServiceRecordStatusSchema>;

export const ServiceRecordPrioritySchema = z.enum([
  'SAFETY_CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);
export type ServiceRecordPriority = z.infer<typeof ServiceRecordPrioritySchema>;

export const ServiceRecordCategorySchema = z.enum([
  'HYDRAULIC',
  'ENGINE',
  'UNDERCARRIAGE',
  'ELECTRICAL',
  'TIRES_TRACKS',
  'LIGHTS',
  'SAFETY_EQUIPMENT',
  'PM',
  'BREAKDOWN_REPAIR',
  'INSPECTION_FOLLOWUP',
  'OTHER',
]);
export type ServiceRecordCategory = z.infer<typeof ServiceRecordCategorySchema>;

export const ServicePartUsedSchema = z.object({
  partName: z.string().min(1).max(200),
  partNumber: z.string().max(80).optional(),
  quantity: z.number().nonnegative(),
  unitCostCents: z.number().int().nonnegative().default(0),
});
export type ServicePartUsed = z.infer<typeof ServicePartUsedSchema>;

export const EquipmentServiceRecordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  equipmentId: z.string().min(1).max(120),
  status: ServiceRecordStatusSchema.default('OPEN'),
  priority: ServiceRecordPrioritySchema.default('MEDIUM'),
  category: ServiceRecordCategorySchema.default('OTHER'),

  openedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  closedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  requestedByEmployeeId: z.string().max(60).optional(),
  requestedByName: z.string().min(1).max(120),
  assignedToEmployeeId: z.string().max(60).optional(),
  assignedToName: z.string().max(120).optional(),

  description: z.string().min(1).max(4_000),
  correctiveAction: z.string().max(4_000).optional(),

  parts: z.array(ServicePartUsedSchema).default([]),
  laborHours: z.number().nonnegative().default(0),
  laborRateCentsPerHour: z.number().int().nonnegative().default(0),

  redTagged: z.boolean().default(false),

  hoursAtRequest: z.number().nonnegative().optional(),
  hoursAtClose: z.number().nonnegative().optional(),

  linkedInspectionId: z.string().max(60).optional(),
  photoRefs: z.array(z.string().max(800)).default([]),
  notes: z.string().max(10_000).optional(),
});
export type EquipmentServiceRecord = z.infer<typeof EquipmentServiceRecordSchema>;

export const EquipmentServiceRecordCreateSchema = EquipmentServiceRecordSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: ServiceRecordStatusSchema.optional(),
  priority: ServiceRecordPrioritySchema.optional(),
  category: ServiceRecordCategorySchema.optional(),
  parts: z.array(ServicePartUsedSchema).optional(),
  laborHours: z.number().nonnegative().optional(),
  laborRateCentsPerHour: z.number().int().nonnegative().optional(),
  redTagged: z.boolean().optional(),
  photoRefs: z.array(z.string().max(800)).optional(),
});
export type EquipmentServiceRecordCreate = z.infer<typeof EquipmentServiceRecordCreateSchema>;

export const EquipmentServiceRecordPatchSchema = EquipmentServiceRecordCreateSchema.partial();
export type EquipmentServiceRecordPatch = z.infer<typeof EquipmentServiceRecordPatchSchema>;

export function newServiceRecordId(): string {
  return 'wo-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

export function isServiceRecordOpen(
  record: Pick<EquipmentServiceRecord, 'status'>,
): boolean {
  return record.status === 'OPEN' || record.status === 'IN_PROGRESS';
}

export function totalPartsCostCents(
  record: Pick<EquipmentServiceRecord, 'parts'>,
): number {
  return record.parts.reduce(
    (sum, p) => sum + Math.round(p.quantity * p.unitCostCents),
    0,
  );
}

export function totalLaborCostCents(
  record: Pick<EquipmentServiceRecord, 'laborHours' | 'laborRateCentsPerHour'>,
): number {
  return Math.round(record.laborHours * record.laborRateCentsPerHour);
}

export function totalRepairCostCents(
  record: Pick<
    EquipmentServiceRecord,
    'parts' | 'laborHours' | 'laborRateCentsPerHour'
  >,
): number {
  return totalPartsCostCents(record) + totalLaborCostCents(record);
}

export function serviceRecordPriorityLabel(p: ServiceRecordPriority): string {
  return p.replace(/_/g, ' ').toLowerCase();
}

export function serviceRecordCategoryLabel(c: ServiceRecordCategory): string {
  return c.replace(/_/g, ' ').toLowerCase();
}

export function shouldRedTag(
  record: Pick<EquipmentServiceRecord, 'priority' | 'status' | 'redTagged'>,
): boolean {
  if (record.status === 'CLOSED' || record.status === 'CANCELLED') return false;
  if (record.priority === 'SAFETY_CRITICAL') return true;
  return record.redTagged;
}
