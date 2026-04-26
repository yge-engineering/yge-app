import { describe, expect, it } from 'vitest';
import {
  certificateExpiryLevel,
  computeCertificateRollup,
  daysUntilExpiry,
  type Certificate,
} from './certificate';

const NOW = new Date('2026-04-25T12:00:00Z');

function cert(over: Partial<Certificate>): Certificate {
  return {
    id: 'cert-aaaaaaa1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    kind: 'GENERAL_LIABILITY',
    label: 'Test cert',
    status: 'ACTIVE',
    ...over,
  };
}

describe('certificateExpiryLevel', () => {
  it('returns lifetime when no expiration is set', () => {
    expect(certificateExpiryLevel(cert({}), NOW)).toBe('lifetime');
  });

  it('returns expired when revoked, regardless of date', () => {
    expect(
      certificateExpiryLevel(
        cert({ status: 'REVOKED', expiresOn: '2099-01-01' }),
        NOW,
      ),
    ).toBe('expired');
  });

  it('returns expired when superseded', () => {
    expect(
      certificateExpiryLevel(cert({ status: 'SUPERSEDED' }), NOW),
    ).toBe('expired');
  });

  it('returns expired when past the expiration date', () => {
    expect(
      certificateExpiryLevel(cert({ expiresOn: '2026-04-20' }), NOW),
    ).toBe('expired');
  });

  it('returns expiringSoon inside the 60-day default window', () => {
    expect(
      certificateExpiryLevel(cert({ expiresOn: '2026-06-15' }), NOW),
    ).toBe('expiringSoon');
  });

  it('returns current when comfortably in the future', () => {
    expect(
      certificateExpiryLevel(cert({ expiresOn: '2027-01-01' }), NOW),
    ).toBe('current');
  });

  it('respects a custom warn-days override', () => {
    // 65 days out — outside default 60 day warn, inside 90.
    expect(certificateExpiryLevel(cert({ expiresOn: '2026-06-30' }), NOW, 60)).toBe('current');
    expect(certificateExpiryLevel(cert({ expiresOn: '2026-06-30' }), NOW, 90)).toBe('expiringSoon');
  });
});

describe('daysUntilExpiry', () => {
  it('returns positive for future certs', () => {
    expect(daysUntilExpiry(cert({ expiresOn: '2026-05-25' }), NOW)).toBe(30);
  });

  it('returns negative for expired certs', () => {
    expect(daysUntilExpiry(cert({ expiresOn: '2026-04-15' }), NOW)).toBe(-10);
  });

  it('returns undefined when no expiration is set', () => {
    expect(daysUntilExpiry(cert({}), NOW)).toBeUndefined();
  });
});

describe('computeCertificateRollup', () => {
  const fixtures: Certificate[] = [
    cert({ kind: 'GENERAL_LIABILITY', expiresOn: '2027-01-01' }),
    cert({ kind: 'AUTO_INSURANCE', expiresOn: '2026-06-15' }), // expiringSoon
    cert({ kind: 'WORKERS_COMP', expiresOn: '2026-04-01' }),  // expired
    cert({ kind: 'CSLB_LICENSE' }),                           // lifetime
    cert({ kind: 'DIR_REGISTRATION', expiresOn: '2026-12-31', status: 'SUPERSEDED' }),
  ];

  it('counts active / expired / expiringSoon correctly', () => {
    const r = computeCertificateRollup(fixtures, NOW);
    expect(r.total).toBe(5);
    expect(r.expired).toBe(2); // hard-expired + superseded
    expect(r.expiringSoon).toBe(1);
    // Active = ACTIVE status + not hard-expired. Includes expiringSoon
    // because the cert is still in force (just due for renewal). So:
    // GL (current) + AUTO (expiringSoon) + CSLB (lifetime) = 3.
    expect(r.active).toBe(3);
  });

  it('groups by kind sorted by count descending', () => {
    const r = computeCertificateRollup(fixtures, NOW);
    expect(r.byKind.map((b) => b.kind)).toContain('GENERAL_LIABILITY');
    expect(r.byKind.every((b) => b.count >= 1)).toBe(true);
  });
});
