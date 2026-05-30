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
  /** CA Employer Account Number (SUI / ETT / SDI). Required on
   *  EDD payroll forms + many CA agency employer questionnaires. */
  caEmployerAccountNumber: z.string().optional(),

  // ---- Address ----
  addressOneLine: z.string(),
  addressStreet: z.string(),
  addressCity: z.string(),
  addressState: z.string(),
  addressZip: z.string(),
  /** California county where HQ is located. Some bid forms ask
   *  for "Contractor's county of residence" separately. */
  addressCounty: z.string().optional(),

  // ---- Contact ----
  primaryPhone: z.string(),
  /** Primary fax — still appears on a surprising number of
   *  legacy paper-to-PDF county forms. */
  primaryFax: z.string().optional(),
  primaryEmail: z.string(),
  websiteUrl: z.string().optional(),

  // ---- Officers ----
  presidentName: z.string(),
  /** Officer title — e.g. "President", "CEO". Many agency bid
   *  forms have a "Title of Authorized Signer" field. */
  presidentTitle: z.string().optional(),
  presidentPhone: z.string(),
  presidentEmail: z.string(),
  vpName: z.string(),
  vpTitle: z.string().optional(),
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
  shortName: 'shortName',
  cslbLicense: 'cslbLicense',
  cslbClassifications: 'cslbClassifications',
  dirNumber: 'dirNumber',
  dotNumber: 'dotNumber',
  federalEin: 'federalEin',
  naicsCodes: 'naicsCodes',
  pscCodes: 'pscCodes',
  caMcpNumber: 'caMcpNumber',
  caEntityNumber: 'caEntityNumber',
  caEmployerAccountNumber: 'caEmployerAccountNumber',
  websiteUrl: 'websiteUrl',
  primaryFax: 'primaryFax',
  'address.street': 'addressStreet',
  'address.city': 'addressCity',
  'address.state': 'addressState',
  'address.zip': 'addressZip',
  'address.county': 'addressCounty',
  primaryPhone: 'primaryPhone',
  primaryEmail: 'primaryEmail',
  'officers.president.name': 'presidentName',
  'officers.president.title': 'presidentTitle',
  'officers.president.phone': 'presidentPhone',
  'officers.president.email': 'presidentEmail',
  'officers.vp.name': 'vpName',
  'officers.vp.title': 'vpTitle',
  'officers.vp.phone': 'vpPhone',
  'officers.vp.email': 'vpEmail',
};

/** Human-readable labels for snapshot field names. Showing
 *  "Federal EIN" beats "federalEin" when listing fields to the
 *  user. The web ExtensionSnapshotStatusTile uses this; the
 *  popup mirrors only the count, not the labels.
 *
 *  Keep in sync with the schema — when adding a new field above,
 *  add a label here too. Falls back to the raw key for unknown
 *  fields so a missing entry is gracefully degraded. */
export const EXTENSION_SNAPSHOT_FIELD_LABELS: Record<
  keyof ExtensionProfileSnapshot,
  string
> = {
  schemaVersion: 'Schema version',
  generatedAt: 'Generated at',
  legalName: 'Legal name',
  shortName: 'Short name / DBA',
  federalEin: 'Federal EIN',
  cslbLicense: 'CSLB license',
  cslbClassifications: 'CSLB classifications',
  dirNumber: 'DIR registration',
  dotNumber: 'USDOT',
  naicsCodes: 'NAICS codes',
  pscCodes: 'PSC codes',
  caMcpNumber: 'CA MCP number',
  caEntityNumber: 'CA SOS entity number',
  caEmployerAccountNumber: 'CA employer account #',
  websiteUrl: 'Website URL',
  primaryFax: 'Primary fax',
  addressOneLine: 'Address (one line)',
  addressStreet: 'Address street',
  addressCity: 'Address city',
  addressState: 'Address state',
  addressZip: 'Address ZIP',
  addressCounty: 'Address county',
  primaryPhone: 'Primary phone',
  primaryEmail: 'Primary email',
  presidentName: 'President name',
  presidentTitle: 'President title',
  presidentPhone: 'President phone',
  presidentEmail: 'President email',
  vpName: 'VP name',
  vpTitle: 'VP title',
  vpPhone: 'VP phone',
  vpEmail: 'VP email',
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
