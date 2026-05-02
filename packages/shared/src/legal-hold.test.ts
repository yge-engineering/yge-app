import { describe, expect, it } from 'vitest';
import {
  LegalHoldSchema,
  computeLegalHoldRollup,
  isEntityFrozen,
  isHoldActive,
  newLegalHoldId,
  type LegalHold,
} from './legal-hold';

function hold(over: Partial<LegalHold> = {}): LegalHold {
  return LegalHoldSchema.parse({
    id: 'hold-aaaaaaaa',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
    companyId: 'co-yge',
    status: 'ACTIVE',
    reason: 'CONTRACT_DISPUTE',
    title: 'Sulphur Springs delay claim',
    entities: [{ entityType: 'Job', entityId: 'job-2026-01-15-sulphur-springs-aabbccdd' }],
    matterDate: '2026-04-01',
    ...over,
  });
}

describe('newLegalHoldId', () => {
  it('produces a hold-<8hex> id', () => {
    expect(newLegalHoldId()).toMatch(/^hold-[0-9a-f]{8}$/);
  });
});

describe('LegalHoldSchema', () => {
  it('rejects an empty entities array', () => {
    expect(() => hold({ entities: [] })).toThrow();
  });

  it('rejects malformed matterDate', () => {
    expect(() => hold({ matterDate: '2026/04/01' })).toThrow();
  });
});

describe('isHoldActive', () => {
  it('true while ACTIVE + before any expectedReleaseDate', () => {
    expect(isHoldActive(hold(), '2026-04-15')).toBe(true);
  });

  it('false when status is RELEASED', () => {
    expect(isHoldActive(hold({ status: 'RELEASED' }))).toBe(false);
  });

  it('false when expectedReleaseDate is past', () => {
    expect(
      isHoldActive(
        hold({ expectedReleaseDate: '2026-04-10' }),
        '2026-04-15',
      ),
    ).toBe(false);
  });

  it('still active on the expectedReleaseDate', () => {
    expect(
      isHoldActive(
        hold({ expectedReleaseDate: '2026-04-15' }),
        '2026-04-15',
      ),
    ).toBe(true);
  });
});

describe('isEntityFrozen', () => {
  const holds = [
    hold({
      id: 'hold-1',
      entities: [{ entityType: 'Job', entityId: 'job-2026-01-15-sulphur-springs-aabbccdd' }],
    }),
    hold({
      id: 'hold-2',
      status: 'RELEASED',
      entities: [{ entityType: 'Job', entityId: 'job-2026-02-01-foo-99999999' }],
    }),
  ];

  it('true for the held job', () => {
    expect(isEntityFrozen(holds, 'Job', 'job-2026-01-15-sulphur-springs-aabbccdd', '2026-04-15')).toBe(true);
  });

  it('false for an unrelated entity', () => {
    expect(isEntityFrozen(holds, 'Job', 'job-2026-03-01-other-deadbeef', '2026-04-15')).toBe(false);
  });

  it('false when the only matching hold is RELEASED', () => {
    expect(isEntityFrozen(holds, 'Job', 'job-2026-02-01-foo-99999999', '2026-04-15')).toBe(false);
  });
});

describe('computeLegalHoldRollup', () => {
  it('counts statuses + flags stale active holds (matterDate >1 yr old)', () => {
    const longAgo = new Date();
    longAgo.setUTCFullYear(longAgo.getUTCFullYear() - 2);
    const matterAgo = longAgo.toISOString().slice(0, 10);

    const holds = [
      hold({ id: 'hold-1', status: 'ACTIVE', matterDate: matterAgo }),
      hold({ id: 'hold-2', status: 'ACTIVE' }),
      hold({ id: 'hold-3', status: 'RELEASED' }),
      hold({ id: 'hold-4', status: 'EXPIRED' }),
    ];
    const r = computeLegalHoldRollup(holds);
    expect(r.total).toBe(4);
    expect(r.byStatus.ACTIVE).toBe(2);
    expect(r.byStatus.RELEASED).toBe(1);
    expect(r.byStatus.EXPIRED).toBe(1);
    expect(r.staleActiveCount).toBe(1);
  });
});
