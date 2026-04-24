// Zod schemas shared between web, API, and mobile.
// Every API input must pass through one of these before touching Prisma.

import { z } from 'zod';

export const RateTypeSchema = z.enum(['PRIVATE', 'PW', 'DB', 'IBEW']);
export type RateTypeValue = z.infer<typeof RateTypeSchema>;

export const JobStatusSchema = z.enum([
  'BIDDING',
  'AWARDED',
  'ACTIVE',
  'ON_HOLD',
  'CLOSED',
  'LOST',
]);

export const CreateJobInputSchema = z.object({
  customerId: z.string().cuid(),
  jobNumber: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  contractNum: z.string().max(80).optional(),
  county: z.string().max(60).optional(),
  status: JobStatusSchema.default('BIDDING'),
  rateType: RateTypeSchema.default('PW'),
  estStart: z.coerce.date().optional(),
  estEnd: z.coerce.date().optional(),
  bondRequired: z.boolean().default(false),
});
export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;

export const CostLineCategorySchema = z.enum([
  'LABOR',
  'EQUIPMENT_OWNED',
  'EQUIPMENT_RENTAL',
  'MATERIAL',
  'SUBCONTRACT',
  'OTHER',
]);

export const CreateCostLineInputSchema = z.object({
  bidItemId: z.string().cuid(),
  category: CostLineCategorySchema,
  costCodeId: z.string().cuid().optional(),
  laborRateId: z.string().cuid().optional(),
  equipmentRateId: z.string().cuid().optional(),
  equipmentRentalId: z.string().cuid().optional(),
  materialId: z.string().cuid().optional(),
  subcontractorId: z.string().cuid().optional(),
  literalDescription: z.string().max(500).optional(),
  literalUnitCost: z.number().int().nonnegative().optional(),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1).max(20),
  otMultiplier: z.number().positive().default(1),
  notes: z.string().optional(),
});
export type CreateCostLineInput = z.infer<typeof CreateCostLineInputSchema>;

// Plans-to-Estimate input — AI endpoint
export const PlansToEstimateInputSchema = z.object({
  jobId: z.string().cuid(),
  docType: z.enum(['PLAN_SET', 'SPEC_ONLY']),
  fileKeys: z.array(z.string()).min(1), // Supabase Storage keys
  sessionNotes: z.string().optional(),
});
export type PlansToEstimateInput = z.infer<typeof PlansToEstimateInputSchema>;
