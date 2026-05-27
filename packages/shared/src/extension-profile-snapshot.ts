// Extension profile snapshot.
//
// What the YGE form-filler browser extension (extensions/yge-form-filler)
// downloads from the API to fill agency forms. Intentionally a small
// flat shape — every key is a string the extension can paste into a
// matched DOM field without further computation.
//
// Why flat strings instead of a full MasterProfile:
//   - The extension shouldn't need a Zod runtime in its bundle.
//   - The extension shouldn't have to navigate nested address /
//     officer arrays to fill simple "Company Name" + "CSLB License"
//     blanks.
//   - Pre-formatting (e.g. address as one line, officer phone with
//     standard dashes) lives server-side so every consumer renders
//     the same string.
//
// What the extension does NOT get:
//   - SSN last-4, full bank account numbers, anything from sensitive
//     paths (master-profile.ts SENSITIVE_PATHS list). The extension
//     prompts the user inline when a form needs those.
//   - Internal notes, capacity utilization, etc. — only the values
//     that actually land in agency forms.

import { z } from 'zod';

export const ExtensionProfileSnapshotSchema = z.object({
  /** Schema version — bumped when the shape changes so older
   *  extension installs know to refresh. */
  schemaVersion: z.literal(1),
  /** ISO timestamp the snapshot was built — extension caches
   *  this and refreshes on a stale-time policy. */
  generatedAt: z.string(),

  // ---- Identity ----
  legalName: z.string(),
  shortName: z.string(),
  federalEin: z.string().optional(),

  // ---- Licenses ----
  cslbLicense: z.string(),
  cslbClassifications: z.string(),  // joined "A, C-12"
  dirNumber: z.string(),
  dotNumber: z.string().optional(),

  // ---- Federal codes ----
  naicsCodes: z.string(),  // joined "115310"
  pscCodes: z.string(),    // joined "F003, F004"

  // ---- California-specific identifiers ----
  /** CA Motor Carrier Permit number — fills heavy-haul forms. */
  caMcpNumber: z.string().optional(),
  /** CA Secretary of State entity number — fills CA bidder forms. */
  caEntityNumber: z.string().optional(),

  // ---- Address ----
  addressOneLine: z.string(),
  addressStreet: z.string(),
  addressCity: z.string(),
  addressState: z.string(),
  addressZip: z.string(),

  // ---- Contact ----
  primaryPhone: z.string(),
  primaryEmail: z.string(),
  websiteUrl: z.string().optional(),

  // ---- Officers ----
  presidentName: z.string(),
  presidentPhone: z.string(),
  presidentEmail: z.string(),
  vpName: z.string(),
  vpPhone: z.string(),
  vpEmail: z.string(),
});

export type ExtensionProfileSnapshot = z.infer<
  typeof ExtensionProfileSnapshotSchema
>;

/** Map from extension profile-snapshot keys → field-patterns.js
 *  profilePath strings. The extension's classifier emits the
 *  right-side path; this map turns it back into the actual
 *  snapshot field. Single source of truth so the classifier and
 *  the snapshot can't drift apart. */
export const PROFILE_PATH_TO_SNAPSHOT_KEY: Record<
  string,
  keyof ExtensionProfileSnapshot
> = {
  legalName: 'legalName',
  cslbLicense: 'cslbLicense',
  cslbClassifications: 'cslbClassifications',
  dirNumber: 'dirNumber',
  dotNumber: 'dotNumber',
  federalEin: 'federalEin',
  naicsCodes: 'naicsCodes',
  pscCodes: 'pscCodes',
  caMcpNumber: 'caMcpNumber',
  caEntityNumber: 'caEntityNumber',
  websiteUrl: 'websiteUrl',
  'address.street': 'addressStreet',
  'address.city': 'addressCity',
  'address.state': 'addressState',
  'address.zip': 'addressZip',
  primaryPhone: 'primaryPhone',
  primaryEmail: 'primaryEmail',
  'officers.president.name': 'presidentName',
  'officers.president.phone': 'presidentPhone',
  'officers.president.email': 'presidentEmail',
  'officers.vp.name': 'vpName',
  'officers.vp.phone': 'vpPhone',
  'officers.vp.email': 'vpEmail',
};

/** Resolve a profile path (from field-patterns.js) to the
 *  snapshot value. Returns undefined when the path isn't mapped
 *  or the snapshot field is empty. */
export function lookupSnapshotValue(
  snapshot: ExtensionProfileSnapshot,
  profilePath: string,
): string | undefined {
  const key = PROFILE_PATH_TO_SNAPSHOT_KEY[profilePath];
  if (!key) return undefined;
  const v = snapshot[key];
  if (typeof v !== 'string') return undefined;
  if (v.length === 0) return undefined;
  return v;
}
