// File-based store for the master business profile.
//
// Single-row store: there's exactly one master profile per company.
// The id 'master' is reserved as the primary key — it's NOT a UUID.
// On first read with no row on disk, the store seeds a default
// profile from packages/shared/src/company.ts (YGE_COMPANY_INFO)
// so the form filler always has SOMETHING to read against.
//
// Every mutation here records an audit event via recordAudit() —
// CLAUDE.md mandates 'every mutation is audit-logged'. Master
// profile changes are particularly important to log: every form
// printed downstream rebases against the new values the moment
// the profile is updated.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  MasterProfileSchema,
  YGE_COMPANY_INFO,
  type MasterProfile,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

function dataDir(): string {
  return (
    process.env.MASTER_PROFILE_DATA_DIR ??
    path.resolve(process.cwd(), 'data', 'master-profile')
  );
}
function rowPath(): string { return path.join(dataDir(), 'master.json'); }

async function ensureDir() { await fs.mkdir(dataDir(), { recursive: true }); }

/**
 * Default profile seeded from the static company-info constant.
 * Used when the store is read for the first time — saves the user
 * from having to fill in basics that are already in the codebase.
 */
function seed(): MasterProfile {
  const c = YGE_COMPANY_INFO;
  const now = new Date().toISOString();
  return MasterProfileSchema.parse({
    id: 'master',
    createdAt: now,
    updatedAt: now,
    legalName: c.legalName,
    shortName: c.shortName,
    cslbLicense: c.cslbLicense,
    cslbClassifications: [],
    dirNumber: c.dirNumber,
    dotNumber: c.dotNumber,
    naicsCodes: c.naicsCodes,
    pscCodes: c.pscCodes,
    address: {
      street: c.address.street,
      city: c.address.city,
      state: c.address.state,
      zip: c.address.zip,
    },
    primaryPhone: c.president.phone,
    primaryEmail: c.president.email,
    officers: [
      {
        id: 'officer-president',
        name: c.president.name,
        title: c.president.title,
        roleKey: c.president.roleKey ?? 'president',
        phone: c.president.phone,
        email: c.president.email,
      },
      {
        id: 'officer-vp',
        name: c.vicePresident.name,
        title: c.vicePresident.title,
        roleKey: c.vicePresident.roleKey ?? 'vp',
        phone: c.vicePresident.phone,
        email: c.vicePresident.email,
      },
    ],
    insurance: [],
    isDbe: false,
    isSbe: false,
    isDvbe: false,
    isWbe: false,
  });
}

export async function getMasterProfile(): Promise<MasterProfile> {
  try {
    const raw = await fs.readFile(rowPath(), 'utf8');
    return MasterProfileSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Seed on first read so callers don't have to handle null.
      const seeded = seed();
      await ensureDir();
      await fs.writeFile(rowPath(), JSON.stringify(seeded, null, 2), 'utf8');
      return seeded;
    }
    throw err;
  }
}

export async function updateMasterProfile(
  patch: Partial<MasterProfile>,
  ctx?: AuditContext,
): Promise<MasterProfile> {
  const existing = await getMasterProfile();
  const now = new Date().toISOString();
  // Strip patch fields that would corrupt identity / lifecycle.
  const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...safePatch } = patch;
  const updated: MasterProfile = MasterProfileSchema.parse({
    ...existing,
    ...safePatch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now,
  });
  await ensureDir();
  await fs.writeFile(rowPath(), JSON.stringify(updated, null, 2), 'utf8');
  await recordAudit({
    action: 'update',
    entityType: 'Company',
    entityId: existing.id,
    before: existing,
    after: updated,
    ctx,
  });
  return updated;
}
