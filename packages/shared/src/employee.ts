// Employee — a person on YGE's payroll.
//
// Phase 1 scope is "the weekly crew roster" — enough fields to email out a
// foreman-grouped list and to support the §4104 / DIR public-works
// classification breakdown. Pay rate, banking, W-4 details land in Phase 5
// when the employee self-service portal + payroll integration ship.
//
// What goes on the employee vs. on a separate timecard / certified-payroll
// row? The employee carries the *standing* facts (name, role, classification,
// who they report to, cert expirations). Timecards carry per-pay-period
// hours; certified payroll carries per-job per-day hours. Don't put either
// of those here.
//
// File-backed in Phase 1, identical surface area to the future Postgres
// Employee model so the swap is a one-day refactor.

import { z } from 'zod';

/** YGE internal role — what does the person *do* day to day? Free-form-ish
 *  but constrained to a small set so the foreman-grouping works. Think
 *  "what bucket would a foreman put them in on a crew sheet" — not a DIR
 *  classification, that lives separately. */
export const EmployeeRoleSchema = z.enum([
  'OWNER',          // Brook, Ryan
  'OFFICE',         // estimating, AP/AR
  'PROJECT_MANAGER',
  'SUPERINTENDENT',
  'FOREMAN',
  'OPERATOR',       // equipment operator
  'TRUCK_DRIVER',
  'LABORER',
  'MECHANIC',
  'APPRENTICE',
  'OTHER',
]);
export type EmployeeRole = z.infer<typeof EmployeeRoleSchema>;

/** DIR / California prevailing-wage classification. Used on certified payroll
 *  reports to map the employee to the right rate row. The set here covers
 *  the classifications YGE actually uses; any classification that isn't in
 *  this list goes under OTHER and the estimator types a free-form override. */
export const DirClassificationSchema = z.enum([
  'OPERATING_ENGINEER_GROUP_1',
  'OPERATING_ENGINEER_GROUP_2',
  'OPERATING_ENGINEER_GROUP_3',
  'OPERATING_ENGINEER_GROUP_4',
  'OPERATING_ENGINEER_GROUP_5',
  'TEAMSTER_GROUP_1',
  'TEAMSTER_GROUP_2',
  'LABORER_GROUP_1',
  'LABORER_GROUP_2',
  'LABORER_GROUP_3',
  'CARPENTER',
  'CEMENT_MASON',
  'IRONWORKER',
  'NOT_APPLICABLE', // private work / non-prevailing-wage role (office, mgmt)
  'OTHER',
]);
export type DirClassification = z.infer<typeof DirClassificationSchema>;

/** Employment status — drives whether the row shows on the active roster. */
export const EmploymentStatusSchema = z.enum([
  'ACTIVE',
  'ON_LEAVE',
  'LAID_OFF',
  'TERMINATED',
]);
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;

/** A certification or credential the employee holds. Tracked for expiry
 *  alerts so the foreman doesn't put a guy with a lapsed CDL on the road. */
export const CertificationKindSchema = z.enum([
  'CDL_A',
  'CDL_B',
  'OSHA_10',
  'OSHA_30',
  'FIRST_AID_CPR',
  'FORKLIFT',
  'TRAFFIC_CONTROL', // ATSSA / county TC certs
  'CONFINED_SPACE',
  'CRANE_OPERATOR',
  'HAZWOPER',
  'OTHER',
]);
export type CertificationKind = z.infer<typeof CertificationKindSchema>;

export const EmployeeCertificationSchema = z.object({
  kind: CertificationKindSchema,
  /** Free-form label printed on the roster. For 'OTHER' this is the only
   *  identifying string. */
  label: z.string().max(120),
  /** ISO yyyy-mm-dd. Optional — some certs (OSHA-30) are lifetime. */
  expiresOn: z.string().max(20).optional(),
  /** Issuer / agency that granted the cert. Free-form. */
  issuer: z.string().max(120).optional(),
});
export type EmployeeCertification = z.infer<typeof EmployeeCertificationSchema>;

export const EmployeeSchema = z.object({
  /** Stable id of the form `emp-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  /** Optional preferred / nick name printed on rosters when set ("Skip"
   *  instead of "Hubert"). */
  displayName: z.string().max(80).optional(),
  /** Mobile number — primary field-contact channel. Free-form so the
   *  foreman can paste however the carrier prints it. */
  phone: z.string().max(40).optional(),
  email: z.string().max(120).optional(),

  role: EmployeeRoleSchema,
  classification: DirClassificationSchema.default('NOT_APPLICABLE'),
  /** Optional free-form override when classification is OTHER. */
  classificationNote: z.string().max(120).optional(),

  /** Foreman this employee reports to on the field. Stores the *id* of
   *  another Employee record (the foreman). Office staff and PMs leave
   *  this empty. */
  foremanId: z.string().max(60).optional(),

  /** Hire date (yyyy-mm-dd). Optional but useful for seniority displays. */
  hiredOn: z.string().max(20).optional(),
  status: EmploymentStatusSchema.default('ACTIVE'),

  /** Certifications + their expirations. Empty array = no certs tracked yet. */
  certifications: z.array(EmployeeCertificationSchema).default([]),

  /** Free-form internal notes — not printed on the roster. */
  notes: z.string().max(4_000).optional(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

/** POST /employees body. */
export const EmployeeCreateSchema = EmployeeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: EmploymentStatusSchema.optional(),
  classification: DirClassificationSchema.optional(),
  certifications: z.array(EmployeeCertificationSchema).optional(),
});
export type EmployeeCreate = z.infer<typeof EmployeeCreateSchema>;

/** PATCH /employees/:id body — every field optional. */
export const EmployeePatchSchema = EmployeeCreateSchema.partial();
export type EmployeePatch = z.infer<typeof EmployeePatchSchema>;

// ---- Display helpers -----------------------------------------------------

export function fullName(e: Pick<Employee, 'firstName' | 'lastName' | 'displayName'>): string {
  if (e.displayName && e.displayName.trim().length > 0) {
    return `${e.displayName} ${e.lastName}`;
  }
  return `${e.firstName} ${e.lastName}`;
}

export function roleLabel(r: EmployeeRole): string {
  switch (r) {
    case 'OWNER': return 'Owner';
    case 'OFFICE': return 'Office';
    case 'PROJECT_MANAGER': return 'Project Manager';
    case 'SUPERINTENDENT': return 'Superintendent';
    case 'FOREMAN': return 'Foreman';
    case 'OPERATOR': return 'Operator';
    case 'TRUCK_DRIVER': return 'Truck Driver';
    case 'LABORER': return 'Laborer';
    case 'MECHANIC': return 'Mechanic';
    case 'APPRENTICE': return 'Apprentice';
    case 'OTHER': return 'Other';
  }
}

export function classificationLabel(c: DirClassification): string {
  switch (c) {
    case 'OPERATING_ENGINEER_GROUP_1': return 'Operating Engineer — Group 1';
    case 'OPERATING_ENGINEER_GROUP_2': return 'Operating Engineer — Group 2';
    case 'OPERATING_ENGINEER_GROUP_3': return 'Operating Engineer — Group 3';
    case 'OPERATING_ENGINEER_GROUP_4': return 'Operating Engineer — Group 4';
    case 'OPERATING_ENGINEER_GROUP_5': return 'Operating Engineer — Group 5';
    case 'TEAMSTER_GROUP_1': return 'Teamster — Group 1';
    case 'TEAMSTER_GROUP_2': return 'Teamster — Group 2';
    case 'LABORER_GROUP_1': return 'Laborer — Group 1';
    case 'LABORER_GROUP_2': return 'Laborer — Group 2';
    case 'LABORER_GROUP_3': return 'Laborer — Group 3';
    case 'CARPENTER': return 'Carpenter';
    case 'CEMENT_MASON': return 'Cement Mason';
    case 'IRONWORKER': return 'Ironworker';
    case 'NOT_APPLICABLE': return 'Not applicable';
    case 'OTHER': return 'Other';
  }
}

export function employmentStatusLabel(s: EmploymentStatus): string {
  switch (s) {
    case 'ACTIVE': return 'Active';
    case 'ON_LEAVE': return 'On leave';
    case 'LAID_OFF': return 'Laid off';
    case 'TERMINATED': return 'Terminated';
  }
}

export function certKindLabel(k: CertificationKind): string {
  switch (k) {
    case 'CDL_A': return 'CDL Class A';
    case 'CDL_B': return 'CDL Class B';
    case 'OSHA_10': return 'OSHA 10';
    case 'OSHA_30': return 'OSHA 30';
    case 'FIRST_AID_CPR': return 'First Aid / CPR';
    case 'FORKLIFT': return 'Forklift';
    case 'TRAFFIC_CONTROL': return 'Traffic Control';
    case 'CONFINED_SPACE': return 'Confined Space';
    case 'CRANE_OPERATOR': return 'Crane Operator';
    case 'HAZWOPER': return 'HAZWOPER';
    case 'OTHER': return 'Other';
  }
}

/** Cert expiry classification — the roster prints "expires soon" rows in red. */
export type CertExpiryStatus = 'lifetime' | 'expired' | 'expiringSoon' | 'current';

/** Returns the urgency band for a cert. expiresOn is yyyy-mm-dd. */
export function certExpiryStatus(
  cert: Pick<EmployeeCertification, 'expiresOn'>,
  now: Date = new Date(),
  warnDays = 30,
): CertExpiryStatus {
  if (!cert.expiresOn) return 'lifetime';
  const expiresAt = new Date(cert.expiresOn + 'T23:59:59');
  if (Number.isNaN(expiresAt.getTime())) return 'lifetime';
  const deltaMs = expiresAt.getTime() - now.getTime();
  if (deltaMs < 0) return 'expired';
  if (deltaMs < warnDays * 24 * 60 * 60 * 1000) return 'expiringSoon';
  return 'current';
}

/** New employee id — `emp-<8hex>`. Random but unique enough within a tenant. */
export function newEmployeeId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `emp-${hex.padStart(8, '0')}`;
}
