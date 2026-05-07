// Postgres-backed store for the master business profile.
//
// Single-row store: exactly one master profile per company. The
// underlying Prisma model uses companyId as the unique key and
// stores the full MasterProfile shape in a JSON `data` column.
// On first read with no row, we seed from YGE_COMPANY_INFO so the
// form filler always has values to read against.
//
// Every mutation records an audit event — CLAUDE.md mandates that.

import { prisma } from '@yge/db';
import {
  MasterProfileSchema,
  YGE_COMPANY_INFO,
  type MasterProfile,
} from '@yge/shared';
import { recordAudit, type AuditContext } from './audit-store';

const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? 'co-yge';

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
  const row = await prisma.masterProfile.findUnique({
    where: { companyId: DEFAULT_COMPANY_ID },
  });
  if (!row) {
    const seeded = seed();
    await prisma.masterProfile.create({
      data: {
        companyId: DEFAULT_COMPANY_ID,
        data: seeded as unknown as object,
      },
    });
    return seeded;
  }
  return MasterProfileSchema.parse(row.data);
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
  await prisma.masterProfile.upsert({
    where: { companyId: DEFAULT_COMPANY_ID },
    create: {
      companyId: DEFAULT_COMPANY_ID,
      data: updated as unknown as object,
    },
    update: { data: updated as unknown as object },
  });
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
