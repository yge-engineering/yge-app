import { describe, expect, it } from 'vitest';
import {
  bindingGaps,
  computeSignatureRollup,
  isLegallyBinding,
  newSignatureId,
  sha256Hex,
  SignatureSchema,
  type Signature,
} from './signature';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

function sig(over: Partial<Signature>): Signature {
  return SignatureSchema.parse({
    id: 'sig-aaaaaaaa',
    createdAt: '2026-04-01T12:00:00Z',
    updatedAt: '2026-04-01T12:00:00Z',
    companyId: 'co-yge',
    status: 'SIGNED',
    method: 'TYPED',
    document: {
      sha256: HASH_A,
      byteLength: 12345,
      documentType: 'BID_ACCEPTANCE',
      displayName: 'Sulphur Springs — Bid Acceptance',
    },
    signer: {
      name: 'Ryan D Young',
      email: 'ryoung@youngge.com',
      title: 'VP, Young General Engineering',
    },
    auditContext: {
      authMethod: 'EMAIL_OTP',
      ipAddress: '10.0.0.5',
      userAgent: 'Mozilla/5.0',
      authenticatedAt: '2026-04-01T11:58:00Z',
    },
    consent: {
      agreedAt: '2026-04-01T11:59:00Z',
      disclosureSha256: HASH_B,
      affirmationText: 'I have read the disclosures and agree to do business electronically.',
    },
    signedAt: '2026-04-01T12:00:00Z',
    flattenedSha256: HASH_C,
    ...over,
  });
}

describe('newSignatureId', () => {
  it('produces a sig-<8hex> id', () => {
    expect(newSignatureId()).toMatch(/^sig-[0-9a-f]{8}$/);
  });
});

describe('SignatureSchema', () => {
  it('rejects a non-hex sha256', () => {
    expect(() =>
      sig({
        document: {
          sha256: 'not-a-hash',
          byteLength: 1,
          documentType: 'OTHER',
          displayName: 'x',
        },
      }),
    ).toThrow(/sha256/);
  });

  it('rejects non-PNG signature image data URLs', () => {
    // The schema's runtime regex catches this; TS sees the dataUrl
    // string as a plain `string`, so no @ts-expect-error needed.
    expect(() =>
      sig({
        signatureImage: { dataUrl: 'data:image/jpeg;base64,xxx', widthPx: 100, heightPx: 50 },
      }),
    ).toThrow();
  });

  it('rejects an invalid signer email', () => {
    expect(() =>
      sig({
        signer: { name: 'Ryan', email: 'not-an-email' },
      }),
    ).toThrow();
  });
});

describe('isLegallyBinding', () => {
  it('returns true for a fully-signed-and-flattened row', () => {
    expect(isLegallyBinding(sig({}))).toBe(true);
  });

  it('returns false until status flips to SIGNED', () => {
    expect(isLegallyBinding(sig({ status: 'DRAFT' }))).toBe(false);
  });

  it('returns false when the flattened pdf hash is missing', () => {
    expect(isLegallyBinding(sig({ flattenedSha256: undefined }))).toBe(false);
  });

  it('returns false when authenticatedAt is missing', () => {
    expect(
      isLegallyBinding(
        sig({ auditContext: { authMethod: 'EMAIL_OTP' } }),
      ),
    ).toBe(false);
  });
});

describe('bindingGaps', () => {
  it('lists every gap blocking legal binding', () => {
    const s = sig({
      status: 'DRAFT',
      signedAt: undefined,
      flattenedSha256: undefined,
      auditContext: { authMethod: 'EMAIL_OTP' },
    });
    const gaps = bindingGaps(s);
    expect(gaps).toContain('status is DRAFT, not SIGNED');
    expect(gaps).toContain('signedAt timestamp missing');
    expect(gaps).toContain('signer was never authenticated');
    expect(gaps).toContain('flattened PDF was never generated');
  });

  it('returns [] when binding', () => {
    expect(bindingGaps(sig({}))).toEqual([]);
  });
});

describe('sha256Hex', () => {
  it('matches the standard SHA-256 of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes empty string', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('computeSignatureRollup', () => {
  it('rolls up counts, status mix, type mix, last-signed, binding count', () => {
    const rows: Signature[] = [
      sig({ id: 'sig-11111111' }),
      sig({
        id: 'sig-22222222',
        status: 'DRAFT',
        signedAt: undefined,
        flattenedSha256: undefined,
        document: {
          sha256: HASH_A,
          byteLength: 100,
          documentType: 'BID_ACCEPTANCE',
          displayName: 'x',
        },
      }),
      sig({
        id: 'sig-33333333',
        document: {
          sha256: HASH_C,
          byteLength: 100,
          documentType: 'LIEN_WAIVER',
          displayName: 'y',
        },
        signedAt: '2026-04-15T00:00:00Z',
      }),
    ];
    const r = computeSignatureRollup(rows);
    expect(r.total).toBe(3);
    expect(r.byStatus.SIGNED).toBe(2);
    expect(r.byStatus.DRAFT).toBe(1);
    expect(r.bindingCount).toBe(2);
    expect(r.lastSignedAt).toBe('2026-04-15T00:00:00Z');
    expect(r.byDocumentType[0]!.type).toBe('BID_ACCEPTANCE');
    expect(r.byDocumentType[0]!.count).toBe(2);
  });

  it('handles empty input', () => {
    const r = computeSignatureRollup([]);
    expect(r.total).toBe(0);
    expect(r.lastSignedAt).toBeNull();
    expect(r.bindingCount).toBe(0);
  });
});
