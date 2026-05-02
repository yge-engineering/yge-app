import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  getAuditEvent,
  listAuditEvents,
  recordAudit,
} from './audit-store';

let tmpDir: string;
const ORIGINAL_ENV = process.env.AUDIT_EVENTS_DATA_DIR;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yge-audit-'));
  process.env.AUDIT_EVENTS_DATA_DIR = tmpDir;
});

afterEach(async () => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.AUDIT_EVENTS_DATA_DIR;
  } else {
    process.env.AUDIT_EVENTS_DATA_DIR = ORIGINAL_ENV;
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('recordAudit', () => {
  it('writes a row that listAuditEvents can read back', async () => {
    const e = await recordAudit({
      action: 'create',
      entityType: 'ApInvoice',
      entityId: 'ap-12345678',
      after: { status: 'DRAFT', totalCents: 1000_00 },
      ctx: {
        actorUserId: 'user-ryan',
        ipAddress: '10.0.0.5',
        userAgent: 'Mozilla/5.0',
      },
    });
    expect(e).not.toBeNull();
    expect(e!.id).toMatch(/^audit-[0-9a-f]{8}$/);
    expect(e!.action).toBe('create');
    expect(e!.entityType).toBe('ApInvoice');
    expect(e!.entityId).toBe('ap-12345678');
    expect(e!.actorUserId).toBe('user-ryan');

    const all = await listAuditEvents();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(e!.id);
  });

  it('defaults companyId to co-yge in dev mode', async () => {
    const e = await recordAudit({
      action: 'login',
      entityType: 'User',
      entityId: 'user-ryan',
    });
    expect(e!.companyId).toBe('co-yge');
  });

  it('keeps before + after JSON for an update event', async () => {
    const e = await recordAudit({
      action: 'update',
      entityType: 'Estimate',
      entityId: 'pe-11111111',
      before: { oppPercent: 0.12 },
      after: { oppPercent: 0.15 },
      ctx: { actorUserId: 'user-ryan', reason: 'Standard markup pass' },
    });
    expect(e!.before).toEqual({ oppPercent: 0.12 });
    expect(e!.after).toEqual({ oppPercent: 0.15 });
    expect(e!.reason).toBe('Standard markup pass');
  });

  it('newest events appear first on list', async () => {
    const a = await recordAudit({ action: 'create', entityType: 'ApInvoice', entityId: 'ap-11111111' });
    await new Promise((r) => setTimeout(r, 4));
    const b = await recordAudit({ action: 'update', entityType: 'ApInvoice', entityId: 'ap-11111111' });
    const all = await listAuditEvents();
    expect(all[0]!.id).toBe(b!.id);
    expect(all[1]!.id).toBe(a!.id);
  });

  it('filters by entityType + entityId', async () => {
    await recordAudit({ action: 'create', entityType: 'ApInvoice', entityId: 'ap-11111111' });
    await recordAudit({ action: 'create', entityType: 'ApInvoice', entityId: 'ap-22222222' });
    await recordAudit({ action: 'create', entityType: 'Estimate', entityId: 'pe-11111111' });
    const r = await listAuditEvents({ entityType: 'ApInvoice', entityId: 'ap-22222222' });
    expect(r).toHaveLength(1);
    expect(r[0]!.entityId).toBe('ap-22222222');
  });
});

describe('getAuditEvent', () => {
  it('returns null on a malformed id', async () => {
    expect(await getAuditEvent('not-an-audit-id')).toBeNull();
  });

  it('returns the row by id', async () => {
    const e = await recordAudit({
      action: 'sign',
      entityType: 'Estimate',
      entityId: 'pe-99999999',
    });
    const got = await getAuditEvent(e!.id);
    expect(got!.id).toBe(e!.id);
    expect(got!.action).toBe('sign');
  });

  it('returns null when the row does not exist', async () => {
    expect(await getAuditEvent('audit-deadbeef')).toBeNull();
  });
});
