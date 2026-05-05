// PortalUser — a person allowed to sign in to the YGE app.
//
// Plain English: distinct from `Employee` (the HR roster). An Employee
// might never log in (laborers / drivers don't); a PortalUser might
// not be on payroll (an external bond agent or owner-rep). The
// overlap is foremen and office staff, who exist in both — there's
// an `employeeId` link for that case so promoting a foreman from
// roster-only to "needs to log in" is a single flag flip.
//
// Stored in apps/api/data/portal-users.json on the persistent disk.

import { z } from 'zod';
import type { PortalRole } from './permissions';

const PORTAL_ROLES = [
  'PRESIDENT',
  'VP',
  'OFFICE',
  'PROJECT_MANAGER',
  'FOREMAN',
  'CREW',
] as const satisfies readonly PortalRole[];

export const PortalRoleSchema = z.enum(PORTAL_ROLES);

export const PortalUserSchema = z.object({
  /** Stable id `pu-<8hex>`. */
  id: z.string().min(1).max(40),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Lower-cased work email. Unique key for sign-in. */
  email: z.string().email().max(254),
  name: z.string().min(1).max(120),
  role: PortalRoleSchema,

  /** Optional link to the matching Employee row. Used by the field
   *  pages to pull crew assignment / certifications without
   *  duplicating the data. */
  employeeId: z.string().max(60).optional(),

  /** For role=FOREMAN: which job ids this user can see. Empty array
   *  means "no jobs visible" — the foreman exists but has nothing to
   *  do until the office assigns them. Other roles ignore this. */
  assignedJobIds: z.array(z.string().max(120)).default([]),

  /** Whether the user has set a password yet. Set by the credentials
   *  endpoint on first login. Surfaced on /admin/portal-users so
   *  Ryan can see who's still pending. */
  hasPassword: z.boolean().default(false),

  /** Optional pause flag — true means "deny sign-in without removing
   *  the row" (e.g. seasonal layoff, leave of absence). */
  disabled: z.boolean().default(false),

  /** ISO datetime of the user's last successful login. */
  lastLoginAt: z.string().optional(),

  /** Free-form admin note (visible only to PortalUsers with
   *  portalUsers:manage). */
  notes: z.string().max(2_000).optional(),
});
export type PortalUser = z.infer<typeof PortalUserSchema>;

/** POST body. Server fills id/createdAt/updatedAt/hasPassword. */
export const PortalUserCreateSchema = PortalUserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  hasPassword: true,
  lastLoginAt: true,
}).extend({
  assignedJobIds: z.array(z.string().max(120)).optional(),
  disabled: z.boolean().optional(),
});
export type PortalUserCreate = z.infer<typeof PortalUserCreateSchema>;

/** PATCH body — every field optional. */
export const PortalUserPatchSchema = PortalUserCreateSchema.partial();
export type PortalUserPatch = z.infer<typeof PortalUserPatchSchema>;

export function newPortalUserId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `pu-${hex.padStart(8, '0')}`;
}
