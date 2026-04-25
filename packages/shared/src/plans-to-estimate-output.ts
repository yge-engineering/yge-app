// Structured output of the Plans-to-Estimate AI endpoint.
// What Claude returns when it reads a plan set / spec / RFP and drafts a bid.

import { z } from 'zod';

export const PtoEItemConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type PtoEItemConfidence = z.infer<typeof PtoEItemConfidenceSchema>;

export const PtoEProjectTypeSchema = z.enum([
  'ROAD_RECONSTRUCTION',
  'DRAINAGE',
  'BRIDGE',
  'GRADING',
  'FIRE_FUEL_REDUCTION',
  'OTHER',
]);
export type PtoEProjectType = z.infer<typeof PtoEProjectTypeSchema>;

export const PtoEBidItemSchema = z.object({
  itemNumber: z.string().min(1).max(20),
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  quantity: z.number().nonnegative(),
  confidence: PtoEItemConfidenceSchema,
  notes: z.string().max(1000).optional(),
  pageReference: z.string().max(80).optional(),
});
export type PtoEBidItem = z.infer<typeof PtoEBidItemSchema>;

export const PtoEOutputSchema = z.object({
  projectName: z.string().min(1).max(200),
  projectType: PtoEProjectTypeSchema,
  location: z.string().max(200).optional(),
  ownerAgency: z.string().max(200).optional(),
  bidDueDate: z.string().max(40).optional(),
  prebidMeeting: z.string().max(200).optional(),
  bidItems: z.array(PtoEBidItemSchema).min(1),
  assumptions: z.array(z.string().max(500)).default([]),
  questionsForEstimator: z.array(z.string().max(500)).default([]),
  overallConfidence: PtoEItemConfidenceSchema,
});
export type PtoEOutput = z.infer<typeof PtoEOutputSchema>;
