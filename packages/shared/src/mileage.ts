// Per-employee / per-vehicle mileage log.
//
// Drives:
//   - IRS standard mileage rate reimbursement (when an employee uses
//     a personal vehicle for company business)
//   - Vehicle depreciation backup (when a company vehicle is used for
//     personal trips, the personal % subtracts from depreciation)
//   - Per-diem proof (some agencies require mileage backup for travel
//     reimbursement)
//
// Phase 1 stores the entry. Phase 2 will reimburse via the employee
// expense reimbursement flow + auto-post a JE.
//
// IRS standard mileage rate is set yearly. Caller passes the rate that
// was in effect on the trip date so historic entries don't get
// retroactively re-rated when the IRS bumps the rate.

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export const MileagePurposeSchema = z.enum([
  'JOBSITE_TRAVEL',     // home/yard ↔ jobsite
  'INTER_JOBSITE',      // jobsite ↔ jobsite during the day
  'BID_WALK',           // pre-bid site visit
  'AGENCY_MEETING',     // pre-construction, progress, closeout meetings
  'SUPPLY_RUN',         // pick up materials / parts
  'EQUIPMENT_TRANSPORT',
  'OFFICE_ERRAND',      // bank, post office, agency dropoff
  'TRAINING',
  'OTHER',
]);
export type MileagePurpose = z.infer<typeof MileagePurposeSchema>;

export const MileageEntrySchema = z
  .object({
    /** Stable id `mi-<8hex>`. */
    id: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),

    /** Employee who drove. */
    employeeId: z.string().max(120),
    /** Employee name copy at log time. */
    employeeName: z.string().min(1).max(120),

    /** Date of the trip (yyyy-mm-dd). */
    tripDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),

    /** Vehicle — equipment id (eq-<8hex>) for company vehicles, or
     *  free-form description for an employee's personal vehicle. */
    equipmentId: z.string().max(120).optional(),
    vehicleDescription: z.string().min(1).max(200),
    /** Personal vs company. Personal triggers IRS-rate reimbursement. */
    isPersonalVehicle: z.boolean().default(false),

    /** Odometer start + end. Optional — some logs are written from
     *  Google Maps "this trip was 24 miles". */
    odometerStart: z.number().nonnegative().optional(),
    odometerEnd: z.number().nonnegative().optional(),

    /** Business miles claimed for the trip. Always required. Equal to
     *  odometerEnd − odometerStart when both are present. */
    businessMiles: z.number().nonnegative(),

    purpose: MileagePurposeSchema.default('JOBSITE_TRAVEL'),
    /** Optional job tag if cost-coded to a project. */
    jobId: z.string().max(120).optional(),

    /** Free-form description of the trip ("Yard → Sulphur Springs Rd
     *  station 12+50, returned via Highway 36"). */
    description: z.string().max(500).optional(),

    /** IRS rate in cents per mile that applied on the trip date. Caller
     *  passes this; module multiplies to get the reimbursement amount. */
    irsRateCentsPerMile: z.number().int().nonnegative().optional(),

    /** Has this entry been included in a paid expense reimbursement? */
    reimbursed: z.boolean().default(false),
    reimbursedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),

    notes: z.string().max(10_000).optional(),
  })
  .refine(
    (e) => {
      if (e.odometerStart != null && e.odometerEnd != null) {
        return e.odometerEnd >= e.odometerStart;
      }
      return true;
    },
    'odometerEnd must be ≥ odometerStart',
  );
export type MileageEntry = z.infer<typeof MileageEntrySchema>;

export const MileageEntryCreateSchema = MileageEntrySchema.innerType()
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    purpose: MileagePurposeSchema.optional(),
    isPersonalVehicle: z.boolean().optional(),
    reimbursed: z.boolean().optional(),
  })
  .refine(
    (e) => {
      if (e.odometerStart != null && e.odometerEnd != null) {
        return e.odometerEnd >= e.odometerStart;
      }
      return true;
    },
    'odometerEnd must be ≥ odometerStart',
  );
export type MileageEntryCreate = z.infer<typeof MileageEntryCreateSchema>;

export const MileageEntryPatchSchema = MileageEntrySchema.innerType()
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();
export type MileageEntryPatch = z.infer<typeof MileageEntryPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function mileagePurposeLabel(p: MileagePurpose, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `mileagePurpose.${p}`);
}

/** Reimbursement amount in cents for a single entry. Returns 0 when
 *  the IRS rate isn't set or the vehicle is company-owned. */
export function reimbursementCents(
  e: Pick<MileageEntry, 'businessMiles' | 'irsRateCentsPerMile' | 'isPersonalVehicle'>,
): number {
  if (!e.isPersonalVehicle) return 0;
  if (!e.irsRateCentsPerMile) return 0;
  return Math.round(e.businessMiles * e.irsRateCentsPerMile);
}

export interface MileageRollup {
  total: number;
  totalBusinessMiles: number;
  /** Personal-vehicle miles (the reimbursable subset). */
  personalMiles: number;
  /** Total reimbursable cents across all entries. */
  reimbursableCents: number;
  /** Already-paid reimbursable cents. */
  reimbursedCents: number;
  /** Outstanding cents owed to employees. */
  outstandingCents: number;
}

export function computeMileageRollup(entries: MileageEntry[]): MileageRollup {
  let totalBusinessMiles = 0;
  let personalMiles = 0;
  let reimbursableCents = 0;
  let reimbursedCents = 0;
  for (const e of entries) {
    totalBusinessMiles += e.businessMiles;
    if (e.isPersonalVehicle) personalMiles += e.businessMiles;
    const reimb = reimbursementCents(e);
    reimbursableCents += reimb;
    if (e.reimbursed) reimbursedCents += reimb;
  }
  return {
    total: entries.length,
    totalBusinessMiles,
    personalMiles,
    reimbursableCents,
    reimbursedCents,
    outstandingCents: Math.max(0, reimbursableCents - reimbursedCents),
  };
}

export function newMileageEntryId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `mi-${hex.padStart(8, '0')}`;
}
