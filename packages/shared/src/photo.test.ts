import { describe, expect, it } from 'vitest';
import {
  admissibilityGaps,
  computePhotoRollup,
  isCourtAdmissible,
  newPhotoId,
  PhotoSchema,
  verifyPhotoChain,
  type Photo,
} from './photo';

const HASH = (n: number) => n.toString(16).padStart(2, '0').repeat(32); // 64 hex
const HASH_A = HASH(0xa);
const HASH_B = HASH(0xb);
const HASH_C = HASH(0xc);

function p(over: Partial<Photo>): Photo {
  return PhotoSchema.parse({
    id: 'ph-aaaaaaaa',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    takenOn: '2026-04-01',
    location: 'STA 12+50 culvert inlet',
    caption: 'CMP inlet trench, looking south',
    category: 'PROGRESS',
    reference: 'IMG_2026-04-01-01.jpg',
    ...over,
  });
}

describe('newPhotoId', () => {
  it('produces a ph-<8hex> id', () => {
    expect(newPhotoId()).toMatch(/^ph-[0-9a-f]{8}$/);
  });
});

describe('PhotoSchema v6.2 fields', () => {
  it('rejects a non-hex sha256Hash', () => {
    expect(() => p({ sha256Hash: 'not-a-hash' })).toThrow(/sha256/);
  });

  it('rejects a non-hex prevPhotoSha256', () => {
    expect(() => p({ prevPhotoSha256: 'short' })).toThrow();
  });

  it('rejects a bearing outside [0, 360]', () => {
    expect(() => p({ bearingDegrees: -1 })).toThrow();
    expect(() => p({ bearingDegrees: 361 })).toThrow();
  });

  it('rejects a negative GPS accuracy', () => {
    expect(() => p({ gpsAccuracyMeters: -5 })).toThrow();
  });

  it('accepts a fully-evidence-grade photo', () => {
    const photo = p({
      capturedAt: '2026-04-01T15:32:11-07:00',
      latitude: 40.392,
      longitude: -122.281,
      gpsAccuracyMeters: 4.8,
      altitudeMeters: 168,
      bearingDegrees: 187,
      deviceId: 'iphone-ryan-vendor-id-AB12CD34',
      sha256Hash: HASH_A,
      prevPhotoSha256: null,
      exifJson: { Make: 'Apple', Model: 'iPhone 15 Pro' },
      redactionApplied: false,
    });
    expect(photo.deviceId).toMatch(/iphone-ryan/);
  });
});

describe('isCourtAdmissible', () => {
  const full: Photo = p({
    capturedAt: '2026-04-01T15:32:11-07:00',
    latitude: 40.392,
    longitude: -122.281,
    deviceId: 'iphone-ryan',
    sha256Hash: HASH_A,
  });

  it('returns true when all required fields are present', () => {
    expect(isCourtAdmissible(full)).toBe(true);
  });

  it('returns false when capturedAt is missing', () => {
    expect(isCourtAdmissible({ ...full, capturedAt: undefined })).toBe(false);
  });

  it('returns false when GPS is missing', () => {
    expect(isCourtAdmissible({ ...full, latitude: undefined })).toBe(false);
  });

  it('returns false when deviceId is missing', () => {
    expect(isCourtAdmissible({ ...full, deviceId: undefined })).toBe(false);
  });

  it('returns false when sha256Hash is missing', () => {
    expect(isCourtAdmissible({ ...full, sha256Hash: undefined })).toBe(false);
  });
});

describe('admissibilityGaps', () => {
  it('lists every missing piece', () => {
    const gaps = admissibilityGaps(p({}));
    expect(gaps).toContain('no capturedAt timestamp');
    expect(gaps).toContain('no GPS coords');
    expect(gaps).toContain('no deviceId — chain of custody broken');
    expect(gaps).toContain('no sha256 fingerprint of the original bytes');
  });

  it('returns [] for an admissible photo', () => {
    expect(
      admissibilityGaps(
        p({
          capturedAt: '2026-04-01T15:32:11-07:00',
          latitude: 40,
          longitude: -122,
          deviceId: 'iphone-ryan',
          sha256Hash: HASH_A,
        }),
      ),
    ).toEqual([]);
  });
});

describe('verifyPhotoChain', () => {
  it('valid for a properly linked chain', () => {
    const photos: Photo[] = [
      p({ id: 'ph-1', sha256Hash: HASH_A, prevPhotoSha256: null }),
      p({ id: 'ph-2', sha256Hash: HASH_B, prevPhotoSha256: HASH_A }),
      p({ id: 'ph-3', sha256Hash: HASH_C, prevPhotoSha256: HASH_B }),
    ];
    expect(verifyPhotoChain(photos)).toEqual({
      valid: true,
      brokenAt: [],
      skipped: [],
    });
  });

  it('flags a tampered link', () => {
    const photos: Photo[] = [
      p({ id: 'ph-1', sha256Hash: HASH_A, prevPhotoSha256: null }),
      p({ id: 'ph-2', sha256Hash: HASH_B, prevPhotoSha256: HASH_A }),
      // photo 3 claims to chain off HASH_A but the prior in the
      // ordered list is HASH_B → tamper / reorder evidence
      p({ id: 'ph-3', sha256Hash: HASH_C, prevPhotoSha256: HASH_A }),
    ];
    const r = verifyPhotoChain(photos);
    expect(r.valid).toBe(false);
    expect(r.brokenAt).toEqual([2]);
  });

  it('skips photos without sha256 fingerprints rather than failing the chain', () => {
    const photos: Photo[] = [
      p({ id: 'ph-1', sha256Hash: HASH_A, prevPhotoSha256: null }),
      p({ id: 'ph-2' }), // legacy, no v6.2 metadata
      p({ id: 'ph-3', sha256Hash: HASH_C, prevPhotoSha256: HASH_C }),
    ];
    const r = verifyPhotoChain(photos);
    expect(r.skipped).toEqual([1]);
  });

  it('returns valid for the empty list', () => {
    expect(verifyPhotoChain([])).toEqual({ valid: true, brokenAt: [], skipped: [] });
  });
});

describe('computePhotoRollup v6.2 metrics', () => {
  it('counts admissible + chained alongside total / category / GPS', () => {
    const photos: Photo[] = [
      p({
        id: 'ph-1',
        capturedAt: '2026-04-01T15:32:11-07:00',
        latitude: 40.392,
        longitude: -122.281,
        deviceId: 'iphone-ryan',
        sha256Hash: HASH_A,
      }),
      p({
        id: 'ph-2',
        capturedAt: '2026-04-02T08:01:00-07:00',
        // missing GPS — not admissible, but still chained
        deviceId: 'iphone-ryan',
        sha256Hash: HASH_B,
        category: 'INCIDENT',
      }),
      p({ id: 'ph-3' }), // legacy
    ];
    const r = computePhotoRollup(photos);
    expect(r.total).toBe(3);
    expect(r.admissibleCount).toBe(1);
    expect(r.chainedCount).toBe(2);
    expect(r.missingGps).toBe(2);
  });
});
