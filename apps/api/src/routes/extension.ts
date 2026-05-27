// Extension routes — endpoints the YGE form-filler browser
// extension calls. Today: read-only profile snapshot. The
// extension origin is allow-listed in CORS (bundle 2601);
// auth-bridge ships in a follow-up bundle.

import { Router } from 'express';

import { YGE_COMPANY_INFO, formatCompanyAddressOneLine } from '@yge/shared';
import type { ExtensionProfileSnapshot } from '@yge/shared';

export const extensionRouter = Router();

/**
 * GET /api/extension/profile-snapshot
 *
 * Returns the flat string-only ExtensionProfileSnapshot. Today
 * built from the static YGE_COMPANY_INFO export — when the
 * DB-backed master profile ships, this swaps to a Prisma read
 * keyed by the auth-bridge tenant id.
 *
 * No auth on the route TODAY. The endpoint exposes no sensitive
 * data (excludes SSN, bank acct, full notes per the snapshot
 * contract), so leaking it pre-auth is acceptable for a single-
 * tenant pre-go-live setup. When multi-tenant lands, gate this
 * on the auth-bridge tenant resolver.
 */
extensionRouter.get('/profile-snapshot', (_req, res) => {
  const c = YGE_COMPANY_INFO;
  const snapshot: ExtensionProfileSnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),

    legalName: c.legalName,
    shortName: c.shortName,
    federalEin: undefined,  // not on static YGE_COMPANY_INFO

    cslbLicense: c.cslbLicense,
    cslbClassifications: c.cslbClassifications.join(', '),
    dirNumber: c.dirNumber,
    dotNumber: c.dotNumber,

    naicsCodes: c.naicsCodes.join(', '),
    pscCodes: c.pscCodes.join(', '),

    // CA-specific identifiers — not on the static YGE_COMPANY_INFO
    // export yet. Will fill from DB master-profile when that ships.
    caMcpNumber: undefined,
    caEntityNumber: undefined,

    addressOneLine: formatCompanyAddressOneLine(c),
    addressStreet: c.address.street,
    addressCity: c.address.city,
    addressState: c.address.state,
    addressZip: c.address.zip,
    addressCounty: c.address.county,

    primaryPhone: c.vicePresident.phone,
    primaryEmail: c.vicePresident.email,
    websiteUrl: c.websiteUrl,

    presidentName: c.president.name,
    presidentTitle: c.president.title,
    presidentPhone: c.president.phone,
    presidentEmail: c.president.email,
    vpName: c.vicePresident.name,
    vpTitle: c.vicePresident.title,
    vpPhone: c.vicePresident.phone,
    vpEmail: c.vicePresident.email,
  };
  res.json(snapshot);
});
