import { describe, expect, it } from 'vitest';
import {
  buildVendorPrequal,
  computeVendorPrequalRollup,
} from './vendor-prequal';
import type { Vendor } from './vendor';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    legalName: 'Acme Concrete LLC',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: true,
    w9CollectedOn: '2025-01-15',
    coiOnFile: true,
    coiExpiresOn: '2026-12-31',
    paymentTerms: 'NET_30',
    cslbLicense: '1145219',
    dirRegistration: '1000123456',
    onHold: false,
    ...over,
  } as Vendor;
}

const NOW = new Date('2026-04-25T00:00:00Z');

describe('buildVendorPrequal', () => {
  it('marks a fully-current sub as ready', () => {
    const r = buildVendorPrequal(vendor({}), NOW);
    expect(r.ready).toBe(true);
    expect(r.blockingCount).toBe(0);
    expect(r.advisoryCount).toBe(0);
  });

  it('blocks a sub with no DIR registration', () => {
    const r = buildVendorPrequal(
      vendor({ dirRegistration: undefined }),
      NOW,
    );
    expect(r.ready).toBe(false);
    expect(r.blockingCount).toBe(1);
    const dir = r.checks.find((c) => c.id === 'DIR_ON_FILE')!;
    expect(dir.pass).toBe(false);
    expect(dir.required).toBe(true);
  });

  it('blocks a sub with no CSLB license', () => {
    const r = buildVendorPrequal(
      vendor({ cslbLicense: undefined }),
      NOW,
    );
    expect(r.ready).toBe(false);
    const cslb = r.checks.find((c) => c.id === 'CSLB_ON_FILE')!;
    expect(cslb.pass).toBe(false);
  });

  it('blocks a sub on hold', () => {
    const r = buildVendorPrequal(
      vendor({ onHold: true, onHoldReason: 'Disputed CO' }),
      NOW,
    );
    expect(r.ready).toBe(false);
    const hold = r.checks.find((c) => c.id === 'NOT_ON_HOLD')!;
    expect(hold.pass).toBe(false);
    expect(hold.detail).toBe('Disputed CO');
  });

  it('blocks a sub with expired COI', () => {
    const r = buildVendorPrequal(
      vendor({ coiExpiresOn: '2026-01-01' }),
      NOW,
    );
    expect(r.ready).toBe(false);
    const coi = r.checks.find((c) => c.id === 'COI_CURRENT')!;
    expect(coi.pass).toBe(false);
  });

  it('flags COI expiring within 30 days as advisory only (not blocking)', () => {
    const r = buildVendorPrequal(
      vendor({ coiExpiresOn: '2026-05-15' }), // 20 days from NOW
      NOW,
    );
    expect(r.ready).toBe(true);
    expect(r.advisoryCount).toBe(1);
    const advisory = r.checks.find((c) => c.id === 'COI_EXPIRES_SOON')!;
    expect(advisory.pass).toBe(false);
    expect(advisory.required).toBe(false);
  });

  it('does not require DIR/CSLB for non-subcontractor vendors', () => {
    const r = buildVendorPrequal(
      vendor({
        kind: 'SUPPLIER',
        cslbLicense: undefined,
        dirRegistration: undefined,
        coiOnFile: false,
      }),
      NOW,
    );
    expect(r.ready).toBe(true);
    expect(r.checks.find((c) => c.id === 'DIR_ON_FILE')!.required).toBe(false);
    expect(r.checks.find((c) => c.id === 'CSLB_ON_FILE')!.required).toBe(false);
    expect(r.checks.find((c) => c.id === 'COI_CURRENT')!.required).toBe(false);
  });

  it('blocks a sub with stale W-9 (>3 years old)', () => {
    const r = buildVendorPrequal(
      vendor({ w9CollectedOn: '2022-01-01' }),
      NOW,
    );
    expect(r.ready).toBe(false);
    const w9 = r.checks.find((c) => c.id === 'W9_CURRENT')!;
    expect(w9.pass).toBe(false);
    expect(w9.required).toBe(true);
  });
});

describe('computeVendorPrequalRollup', () => {
  it('counts only subcontractors and buckets by status', () => {
    const r = computeVendorPrequalRollup(
      [
        vendor({ id: 'vnd-1', kind: 'SUPPLIER' }), // ignored
        vendor({ id: 'vnd-2' }), // ready
        vendor({ id: 'vnd-3', dirRegistration: undefined }), // blocked
        vendor({ id: 'vnd-4', coiExpiresOn: '2026-05-15' }), // advisory
      ],
      NOW,
    );
    expect(r.total).toBe(3);
    expect(r.ready).toBe(1);
    expect(r.blocked).toBe(1);
    expect(r.advisoryOnly).toBe(1);
  });
});
