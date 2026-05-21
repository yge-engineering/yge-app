import { describe, expect, it } from 'vitest';
import { matchEmailToVendor, type EmailVendorCandidate } from './email-vendor-match';

const VENDORS: EmailVendorCandidate[] = [
  { id: 'v1', legalName: 'Apex Grading Inc', dbaName: 'Apex Grading', email: 'ar@apexgrading.com' },
  { id: 'v2', legalName: 'Tehama Ready Mix', email: 'billing@tehamareadymix.com' },
  { id: 'v3', legalName: 'North State Engineering', email: 'office@nseng.com' },
];

describe('matchEmailToVendor', () => {
  it('matches an exact from-email', () => {
    const r = matchEmailToVendor(
      { subject: 'COI attached', fromAddress: 'ar@apexgrading.com', bodyPreview: 'cert' },
      VENDORS,
    );
    expect(r.vendorId).toBe('v1');
    expect(r.reasons.some((x) => x.includes('from matches'))).toBe(true);
  });

  it('matches a different address at the same domain', () => {
    const r = matchEmailToVendor(
      { subject: 'Invoice', fromAddress: 'newperson@apexgrading.com', bodyPreview: '' },
      VENDORS,
    );
    expect(r.vendorId).toBe('v1');
    expect(r.reasons.some((x) => x.includes('domain'))).toBe(true);
  });

  it('matches by vendor name in the subject when the email is a generic mailbox', () => {
    const r = matchEmailToVendor(
      { subject: 'Tehama Ready Mix statement', fromAddress: 'someone@gmail.com', bodyPreview: '' },
      VENDORS,
    );
    expect(r.vendorId).toBe('v2');
  });

  it('does not credit a generic domain as a vendor signal', () => {
    const r = matchEmailToVendor(
      { subject: 'hello', fromAddress: 'a@gmail.com', bodyPreview: '' },
      [{ id: 'vg', legalName: 'Some Vendor', email: 'x@gmail.com' }],
    );
    expect(r.vendorId).toBeNull();
  });

  it('returns none when no vendors', () => {
    const r = matchEmailToVendor({ subject: 's', fromAddress: 'a@b.com', bodyPreview: '' }, []);
    expect(r.vendorId).toBeNull();
    expect(r.confidence).toBe('none');
  });

  it('picks the highest-scoring vendor', () => {
    const r = matchEmailToVendor(
      { subject: 'Apex Grading COI', fromAddress: 'ar@apexgrading.com', bodyPreview: 'Apex' },
      VENDORS,
    );
    expect(r.vendorId).toBe('v1');
    expect(r.confidence).toBe('high'); // exact email (6) + name (4) = 10
  });
});
