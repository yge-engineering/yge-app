// Vendor (subcontractor) pre-qualification checklist.
//
// Before a sub can show up on a public-works jobsite, YGE needs to
// have a defined set of records on file. Missing any one of these
// blocks payment + can void the bond on a public job. This module
// derives a per-vendor checklist from the data already in the
// vendor record and surfaces what's still missing.
//
// Items checked:
//   - W-9 on file + within 3-year IRS refresh window (subs are
//     1099-NEC reportable by default)
//   - Certificate of Insurance on file + not expired
//   - CSLB license number recorded (manual lookup of "active" status
//     happens in Phase 2)
//   - DIR registration recorded (required to bid public works)
//   - Vendor not on hold
//
// Phase 1 returns the boolean status; Phase 2 will pull live CSLB
// + DIR API data to verify each license is currently active.

import { vendorCoiCurrent, vendorW9Current, type Vendor } from './vendor';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

export type VendorPrequalCheckId =
  | 'W9_CURRENT'
  | 'COI_CURRENT'
  | 'COI_EXPIRES_SOON'
  | 'CSLB_ON_FILE'
  | 'DIR_ON_FILE'
  | 'NOT_ON_HOLD';

export interface VendorPrequalCheck {
  id: VendorPrequalCheckId;
  label: string;
  /** Higher level explanation that prints on the packet. */
  description: string;
  /** True iff the check is satisfied. */
  pass: boolean;
  /** True iff the check is required for a public-works sub. Failed
   *  required checks block the sub. */
  required: boolean;
  /** Free-form detail printed on the packet (e.g. expiration date). */
  detail?: string;
}

export interface VendorPrequalReport {
  vendorId: string;
  /** Display name copied from the vendor (DBA preferred). */
  vendorName: string;
  /** True iff every required check passed. Drives the "OK to use on
   *  public-works job" badge. */
  ready: boolean;
  /** Number of required checks failed. */
  blockingCount: number;
  /** Number of optional/advisory checks failed. */
  advisoryCount: number;
  checks: VendorPrequalCheck[];
}

/** Days before COI expiration we want to flag with an advisory. */
export const COI_EXPIRY_WARN_DAYS = 30;

/** Build the prequalification report for a single vendor. */
export function buildVendorPrequal(
  v: Vendor,
  now: Date = new Date(),
  locale: Locale = 'en',
): VendorPrequalReport {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(SEED_DICTIONARY, locale, key, vars);
  const checks: VendorPrequalCheck[] = [];
  const isSub = v.kind === 'SUBCONTRACTOR';

  // W-9 (required for any 1099-reportable vendor; subs default to true).
  const w9Pass = vendorW9Current(v, now);
  checks.push({
    id: 'W9_CURRENT',
    label: t('vendorPrequal.w9.label'),
    description: t('vendorPrequal.w9.description'),
    pass: !v.is1099Reportable || w9Pass,
    required: v.is1099Reportable,
    detail: v.w9CollectedOn
      ? t('vendorPrequal.w9.detailCollected', { date: v.w9CollectedOn })
      : v.w9OnFile
        ? t('vendorPrequal.w9.detailOnFile')
        : t('vendorPrequal.w9.detailMissing'),
  });

  // COI on file + current.
  const coiPass = vendorCoiCurrent(v, now);
  checks.push({
    id: 'COI_CURRENT',
    label: t('vendorPrequal.coi.label'),
    description: t('vendorPrequal.coi.description'),
    pass: !isSub || coiPass,
    required: isSub,
    detail: v.coiExpiresOn
      ? t('vendorPrequal.coi.detailExpires', { date: v.coiExpiresOn })
      : v.coiOnFile
        ? t('vendorPrequal.coi.detailOnFile')
        : t('vendorPrequal.coi.detailMissing'),
  });

  // COI expiring soon — advisory only.
  let coiExpiringSoon = false;
  let daysToExpiry: number | null = null;
  if (v.coiExpiresOn) {
    const exp = new Date(v.coiExpiresOn + 'T23:59:59');
    if (!Number.isNaN(exp.getTime())) {
      const msPerDay = 24 * 60 * 60 * 1000;
      daysToExpiry = Math.ceil(
        (exp.getTime() - now.getTime()) / msPerDay,
      );
      coiExpiringSoon =
        daysToExpiry > 0 && daysToExpiry <= COI_EXPIRY_WARN_DAYS;
    }
  }
  checks.push({
    id: 'COI_EXPIRES_SOON',
    label: t('vendorPrequal.coiSoon.label', { days: COI_EXPIRY_WARN_DAYS }),
    description: t('vendorPrequal.coiSoon.description'),
    pass: !coiExpiringSoon,
    required: false,
    detail:
      daysToExpiry != null && daysToExpiry > 0
        ? t('vendorPrequal.coiSoon.detailRemaining', { days: daysToExpiry })
        : daysToExpiry != null && daysToExpiry <= 0
          ? t('vendorPrequal.coiSoon.detailExpired')
          : '—',
  });

  // CSLB license on file (license # only — Phase 2 verifies active).
  checks.push({
    id: 'CSLB_ON_FILE',
    label: t('vendorPrequal.cslb.label'),
    description: t('vendorPrequal.cslb.description'),
    pass: !isSub || (v.cslbLicense != null && v.cslbLicense.trim().length > 0),
    required: isSub,
    detail: v.cslbLicense
      ? t('vendorPrequal.cslb.detailLicense', { license: v.cslbLicense })
      : t('vendorPrequal.cslb.detailMissing'),
  });

  // DIR registration on file.
  checks.push({
    id: 'DIR_ON_FILE',
    label: t('vendorPrequal.dir.label'),
    description: t('vendorPrequal.dir.description'),
    pass: !isSub || (v.dirRegistration != null && v.dirRegistration.trim().length > 0),
    required: isSub,
    detail: v.dirRegistration
      ? t('vendorPrequal.dir.detailRegistered', { dir: v.dirRegistration })
      : t('vendorPrequal.dir.detailMissing'),
  });

  // Not on hold.
  checks.push({
    id: 'NOT_ON_HOLD',
    label: t('vendorPrequal.onHold.label'),
    description: t('vendorPrequal.onHold.description'),
    pass: !v.onHold,
    required: true,
    detail: v.onHold
      ? v.onHoldReason ?? t('vendorPrequal.onHold.detailNoReason')
      : t('vendorPrequal.onHold.detailActive'),
  });

  let blockingCount = 0;
  let advisoryCount = 0;
  for (const c of checks) {
    if (!c.pass) {
      if (c.required) blockingCount += 1;
      else advisoryCount += 1;
    }
  }

  return {
    vendorId: v.id,
    vendorName: v.dbaName ?? v.legalName,
    ready: blockingCount === 0,
    blockingCount,
    advisoryCount,
    checks,
  };
}

export interface VendorPrequalRollup {
  total: number;
  ready: number;
  blocked: number;
  /** Vendors with at least one advisory but no blocking issues. */
  advisoryOnly: number;
}

export function computeVendorPrequalRollup(
  vendors: Vendor[],
  now: Date = new Date(),
): VendorPrequalRollup {
  let ready = 0;
  let blocked = 0;
  let advisoryOnly = 0;
  for (const v of vendors) {
    if (v.kind !== 'SUBCONTRACTOR') continue;
    // Pass and counts are locale-independent — strings get localized at
    // render time. Default 'en' locale here is fine for the rollup math.
    const r = buildVendorPrequal(v, now);
    if (r.ready && r.advisoryCount === 0) ready += 1;
    else if (!r.ready) blocked += 1;
    else advisoryOnly += 1;
  }
  return {
    total: vendors.filter((v) => v.kind === 'SUBCONTRACTOR').length,
    ready,
    blocked,
    advisoryOnly,
  };
}
