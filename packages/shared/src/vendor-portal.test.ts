import { describe, it, expect } from 'vitest';

import {
  vendorPortalEmail,
  vendorIsPortalReady,
  type Vendor,
} from './vendor';

// Test fixtures — partial Vendor shapes are fine since the helpers
// only read a few fields.
function v(overrides: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'Reed Trucking',
    kind: 'TRUCKING',
    paymentTerms: 'NET_30',
    w9OnFile: false,
    is1099Reportable: true,
    coiOnFile: false,
    onHold: false,
    isPortalEnabled: false,
    ...overrides,
  } as Vendor;
}

describe('vendorPortalEmail', () => {
  it('returns portalEmail when set', () => {
    expect(vendorPortalEmail({ portalEmail: 'ar@reed.com', email: 'pm@reed.com' })).toBe(
      'ar@reed.com',
    );
  });

  it('falls back to primary email when portalEmail unset', () => {
    expect(vendorPortalEmail({ email: 'pm@reed.com' })).toBe('pm@reed.com');
  });

  it('returns undefined when both are missing', () => {
    expect(vendorPortalEmail({})).toBeUndefined();
  });

  it('treats blank portalEmail as unset (falls back to email)', () => {
    expect(vendorPortalEmail({ portalEmail: '  ', email: 'pm@reed.com' })).toBe(
      'pm@reed.com',
    );
  });

  it('returns undefined when both are blank', () => {
    expect(vendorPortalEmail({ portalEmail: '', email: '' })).toBeUndefined();
  });
});

describe('vendorIsPortalReady', () => {
  it('is false when isPortalEnabled is false', () => {
    expect(
      vendorIsPortalReady(v({ isPortalEnabled: false, email: 'pm@reed.com' })),
    ).toBe(false);
  });

  it('is false when enabled but no email resolves', () => {
    expect(
      vendorIsPortalReady(v({ isPortalEnabled: true })),
    ).toBe(false);
  });

  it('is true when enabled and primary email resolves', () => {
    expect(
      vendorIsPortalReady(v({ isPortalEnabled: true, email: 'pm@reed.com' })),
    ).toBe(true);
  });

  it('is true when enabled and portalEmail resolves', () => {
    expect(
      vendorIsPortalReady(
        v({ isPortalEnabled: true, portalEmail: 'ar@reed.com' }),
      ),
    ).toBe(true);
  });

  it('prefers portalEmail over the fallback email for ready check', () => {
    expect(
      vendorIsPortalReady(
        v({
          isPortalEnabled: true,
          portalEmail: 'ar@reed.com',
          email: 'pm@reed.com',
        }),
      ),
    ).toBe(true);
  });
});
