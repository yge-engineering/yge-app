// Company info — single source of truth.
//
// Read by every user-facing surface that prints YGE branding: bid summary
// pages, cover letters, certified payroll headers, safety doc footers,
// AP letterhead, etc. When details change (new license number, address
// update, role re-assignment), update them here and every consumer gets
// the new values automatically.
//
// Future: this becomes editable in /settings/company once the company
// settings UI lands. For now it's a static export so we can typecheck the
// shape and avoid a network round-trip on every print.

export interface CompanyContact {
  name: string;
  title: string;
  phone: string;
  email: string;
  /** Optional internal key for routing (e.g. 'president', 'vp', 'safety'). */
  roleKey?: string;
}

export interface CompanyInfo {
  legalName: string;
  shortName: string;
  tagline: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  cslbLicense: string;
  dirNumber: string;
  dotNumber: string;
  /** NAICS codes the company is registered under. */
  naicsCodes: string[];
  /** PSC (Federal Product Service Codes) for federal opportunities. */
  pscCodes: string[];
  /** Public-facing website. Filled into bid forms that ask for
   *  vendor URL (federal SAM forms, many county RFP cover sheets).
   *  Optional because pre-go-live tenants may not have a site yet. */
  websiteUrl?: string;
  president: CompanyContact;
  vicePresident: CompanyContact;
  /** Default validity window for outgoing bids, in days. CA agencies
   *  typically expect 60-90; we default to 60 as a safe lower bound. */
  bidValidityDays: number;
}

export const YGE_COMPANY_INFO: CompanyInfo = {
  legalName: 'Young General Engineering, Inc.',
  shortName: 'YGE',
  tagline: 'Heavy civil contractors',
  address: {
    street: '19645 Little Woods Rd',
    city: 'Cottonwood',
    state: 'CA',
    zip: '96022',
  },
  cslbLicense: '1145219',
  dirNumber: '2000018967',
  dotNumber: '4528204',
  naicsCodes: ['115310'],
  pscCodes: ['F003', 'F004'],
  websiteUrl: 'https://youngge.com',
  president: {
    name: 'Brook L. Young',
    title: 'President',
    phone: '707-499-7065',
    email: 'brookyoung@youngge.com',
  },
  vicePresident: {
    name: 'Ryan D. Young',
    title: 'Vice President',
    phone: '707-599-9921',
    email: 'ryoung@youngge.com',
  },
  bidValidityDays: 60,
};

export function formatCompanyAddressOneLine(c: CompanyInfo = YGE_COMPANY_INFO): string {
  const a = c.address;
  return `${a.street}, ${a.city}, ${a.state} ${a.zip}`;
}

// ---- Bonding + Insurance seeds ----
//
// Default values for the bonding + insurance profiles, exported
// for the master business profile page and any form filler that
// needs the live numbers. Until the editable DB-backed profile
// ships, these stay `null` so the UI surfaces a clear "not
// configured" prompt instead of misleading placeholder
// numbers.
//
// To populate now: edit this file with Brook's real surety +
// carrier data and ship a bundle. To populate later: do it
// through the future /settings/company edit form once the
// Prisma model lands.

import type { BondingProfile } from './company-bonding';
import type { InsuranceProfile } from './company-insurance';

export const YGE_BONDING_PROFILE: BondingProfile | null = null;
export const YGE_INSURANCE_PROFILE: InsuranceProfile | null = null;
