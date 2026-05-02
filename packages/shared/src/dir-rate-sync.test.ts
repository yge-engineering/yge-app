import { describe, expect, it } from 'vitest';
import {
  buildAcceptedApplication,
  computeProposalDiff,
  computeProposalRollup,
  computeSyncRunRollup,
  DirRateProposalSchema,
  DirRateSyncRunSchema,
  newDirRateProposalId,
  newDirRateSyncRunId,
  type DirRateProposal,
  type DirRateProposalDiff,
  type DirRateSyncRun,
} from './dir-rate-sync';
import type { DirRate } from './dir-rate';

function rate(over: Partial<DirRate> = {}): DirRate {
  return {
    id: 'dir-aaaaaaaa',
    createdAt: '2026-02-22T00:00:00Z',
    updatedAt: '2026-02-22T00:00:00Z',
    classification: 'OPERATING_ENGINEER_GROUP_4',
    county: 'Shasta',
    effectiveDate: '2026-02-22',
    basicHourlyCents: 5871_00,
    healthAndWelfareCents: 1235_00,
    pensionCents: 980_00,
    vacationHolidayCents: 410_00,
    trainingCents: 110_00,
    otherFringeCents: 0,
    ...over,
  };
}

function proposed(over: Partial<DirRateProposal['proposedRate']> = {}): DirRateProposal['proposedRate'] {
  const r = rate();
  return {
    classification: r.classification,
    county: r.county,
    effectiveDate: r.effectiveDate,
    expiresOn: r.expiresOn,
    basicHourlyCents: r.basicHourlyCents,
    healthAndWelfareCents: r.healthAndWelfareCents,
    pensionCents: r.pensionCents,
    vacationHolidayCents: r.vacationHolidayCents,
    trainingCents: r.trainingCents,
    otherFringeCents: r.otherFringeCents,
    notes: r.notes,
    sourceUrl: r.sourceUrl,
    ...over,
  };
}

function proposal(over: Partial<DirRateProposal> = {}): DirRateProposal {
  return DirRateProposalSchema.parse({
    id: 'dir-prop-aaaaaaaa',
    createdAt: '2026-08-22T00:00:00Z',
    updatedAt: '2026-08-22T00:00:00Z',
    syncRunId: 'dir-sync-aaaaaaaa',
    classification: 'OPERATING_ENGINEER_GROUP_4',
    county: 'Shasta',
    existingRateId: 'dir-aaaaaaaa',
    proposedRate: proposed(),
    status: 'PENDING',
    ...over,
  });
}

describe('id helpers', () => {
  it('newDirRateSyncRunId follows the pattern', () => {
    expect(newDirRateSyncRunId()).toMatch(/^dir-sync-[0-9a-f]{8}$/);
  });

  it('newDirRateProposalId follows the pattern', () => {
    expect(newDirRateProposalId()).toMatch(/^dir-prop-[0-9a-f]{8}$/);
  });
});

describe('DirRateSyncRunSchema', () => {
  it('rejects an unknown source', () => {
    expect(() =>
      DirRateSyncRunSchema.parse({
        id: 'dir-sync-aaaaaaaa',
        createdAt: '2026-08-22T00:00:00Z',
        updatedAt: '2026-08-22T00:00:00Z',
        source: 'COSMIC_RAY',
      }),
    ).toThrow();
  });

  it('defaults status to QUEUED + counts to 0', () => {
    const r = DirRateSyncRunSchema.parse({
      id: 'dir-sync-aaaaaaaa',
      createdAt: '2026-08-22T00:00:00Z',
      updatedAt: '2026-08-22T00:00:00Z',
      source: 'SCHEDULED',
    });
    expect(r.status).toBe('QUEUED');
    expect(r.proposalsCreated).toBe(0);
    expect(r.classificationsScraped).toBe(0);
    expect(r.classificationsFailed).toBe(0);
  });
});

describe('computeProposalDiff', () => {
  it('reports kind=new and treats the move as significant when no existing', () => {
    const d = computeProposalDiff(null, proposed());
    expect(d.kind).toBe('new');
    expect(d.significantWageMove).toBe(true);
    expect(d.cents.basicHourlyCents).toBe(5871_00);
  });

  it('reports kind=identical when nothing changed', () => {
    const existing = rate();
    const d = computeProposalDiff(existing, proposed());
    expect(d.kind).toBe('identical');
    expect(d.cents.totalPrevailingWageCents).toBe(0);
    expect(d.changedFields).toEqual([]);
  });

  it('flags significant when total prevailing wage moves >= 25c default', () => {
    const existing = rate();
    const d = computeProposalDiff(existing, proposed({ basicHourlyCents: existing.basicHourlyCents + 100 }));
    expect(d.kind).toBe('updated');
    expect(d.cents.basicHourlyCents).toBe(100);
    expect(d.cents.totalPrevailingWageCents).toBe(100);
    expect(d.significantWageMove).toBe(true);
  });

  it('does not flag significant when the wage move is below the threshold', () => {
    const existing = rate();
    const d = computeProposalDiff(existing, proposed({ basicHourlyCents: existing.basicHourlyCents + 10 }));
    expect(d.cents.totalPrevailingWageCents).toBe(10);
    expect(d.significantWageMove).toBe(false);
  });

  it('detects effectiveDate / expiresOn / notes / sourceUrl changes', () => {
    const existing = rate({ notes: 'old', sourceUrl: 'https://old.example/dir' });
    const d = computeProposalDiff(
      existing,
      proposed({
        effectiveDate: '2026-08-22',
        expiresOn: '2027-02-21',
        notes: 'new',
        sourceUrl: 'https://new.example/dir',
      }),
    );
    expect(d.changedFields).toEqual(['effectiveDate', 'expiresOn', 'notes', 'sourceUrl']);
  });

  it('respects a caller-provided significantMoveCents threshold', () => {
    const existing = rate();
    const d = computeProposalDiff(
      existing,
      proposed({ basicHourlyCents: existing.basicHourlyCents + 10 }),
      { significantMoveCents: 5 },
    );
    expect(d.significantWageMove).toBe(true);
  });
});

describe('buildAcceptedApplication', () => {
  it('returns mode=create when the proposal has no existing target', () => {
    const p = proposal({ existingRateId: null });
    const app = buildAcceptedApplication(p, null);
    expect(app.mode).toBe('create');
    expect(app.targetRateId).toBeNull();
    expect(app.body.classification).toBe(p.proposedRate.classification);
  });

  it('returns mode=update with the existing rate id when targeted', () => {
    const existing = rate({ id: 'dir-zzzzzzzz' });
    const p = proposal({ existingRateId: existing.id });
    const app = buildAcceptedApplication(p, existing);
    expect(app.mode).toBe('update');
    expect(app.targetRateId).toBe('dir-zzzzzzzz');
  });
});

describe('computeSyncRunRollup', () => {
  it('rolls up counts + last finishedAt + total proposals', () => {
    const runs: DirRateSyncRun[] = [
      DirRateSyncRunSchema.parse({
        id: 'dir-sync-1', createdAt: '2026-02-22T00:00:00Z', updatedAt: '2026-02-22T00:00:00Z',
        source: 'SCHEDULED', status: 'SUCCESS', finishedAt: '2026-02-22T01:00:00Z',
        proposalsCreated: 12,
      }),
      DirRateSyncRunSchema.parse({
        id: 'dir-sync-2', createdAt: '2026-08-22T00:00:00Z', updatedAt: '2026-08-22T00:00:00Z',
        source: 'SCHEDULED', status: 'PARTIAL', finishedAt: '2026-08-22T01:30:00Z',
        proposalsCreated: 8, classificationsFailed: 2,
      }),
    ];
    const r = computeSyncRunRollup(runs);
    expect(r.total).toBe(2);
    expect(r.byStatus.SUCCESS).toBe(1);
    expect(r.byStatus.PARTIAL).toBe(1);
    expect(r.lastFinishedAt).toBe('2026-08-22T01:30:00Z');
    expect(r.totalProposalsCreated).toBe(20);
  });

  it('handles empty input', () => {
    const r = computeSyncRunRollup([]);
    expect(r.total).toBe(0);
    expect(r.lastFinishedAt).toBeNull();
    expect(r.totalProposalsCreated).toBe(0);
  });
});

describe('computeProposalRollup', () => {
  it('counts pending significant moves separately', () => {
    const p1 = proposal({ id: 'dir-prop-1', status: 'PENDING' });
    const p2 = proposal({ id: 'dir-prop-2', status: 'PENDING' });
    const p3 = proposal({ id: 'dir-prop-3', status: 'ACCEPTED' });
    const diffs = new Map<string, DirRateProposalDiff>([
      ['dir-prop-1', { kind: 'updated', cents: { basicHourlyCents: 0, healthAndWelfareCents: 0, pensionCents: 0, vacationHolidayCents: 0, trainingCents: 0, otherFringeCents: 0, totalPrevailingWageCents: 200 }, changedFields: [], significantWageMove: true }],
      ['dir-prop-2', { kind: 'updated', cents: { basicHourlyCents: 0, healthAndWelfareCents: 0, pensionCents: 0, vacationHolidayCents: 0, trainingCents: 0, otherFringeCents: 0, totalPrevailingWageCents: 5 }, changedFields: [], significantWageMove: false }],
      ['dir-prop-3', { kind: 'updated', cents: { basicHourlyCents: 0, healthAndWelfareCents: 0, pensionCents: 0, vacationHolidayCents: 0, trainingCents: 0, otherFringeCents: 0, totalPrevailingWageCents: 999 }, changedFields: [], significantWageMove: true }],
    ]);
    const r = computeProposalRollup([p1, p2, p3], diffs);
    expect(r.total).toBe(3);
    expect(r.byStatus.PENDING).toBe(2);
    expect(r.byStatus.ACCEPTED).toBe(1);
    expect(r.pendingSignificantCount).toBe(1);
  });
});
