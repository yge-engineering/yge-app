import { describe, expect, it } from 'vitest';
import { buildPcoVelocityReport } from './pco-velocity';
import type { Pco } from './pco';

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '',
    updatedAt: '2026-04-15T00:00:00Z',
    jobId: 'job-1',
    pcoNumber: 'PCO-001',
    title: 'Extra rebar',
    description: 'Something',
    origin: 'OWNER_DIRECTED',
    status: 'CONVERTED_TO_CO',
    noticedOn: '2026-01-01',
    submittedOn: '2026-01-15',
    costImpactCents: 10_000_00,
    scheduleImpactDays: 0,
    ...over,
  } as Pco;
}

describe('buildPcoVelocityReport', () => {
  it('only includes CONVERTED_TO_CO with submittedOn', () => {
    const r = buildPcoVelocityReport({
      pcos: [
        pco({ id: '1', status: 'SUBMITTED' }),
        pco({ id: '2', status: 'REJECTED' }),
        pco({ id: '3', status: 'CONVERTED_TO_CO', submittedOn: undefined }),
        pco({ id: '4', status: 'CONVERTED_TO_CO', submittedOn: '2026-01-15', lastResponseOn: '2026-02-15' }),
      ],
    });
    expect(r.convertedConsidered).toBe(1);
  });

  it('uses lastResponseOn for end-date calc', () => {
    const r = buildPcoVelocityReport({
      pcos: [
        pco({
          submittedOn: '2026-01-01',
          lastResponseOn: '2026-02-15', // 45 days
        }),
      ],
    });
    expect(r.blendedMeanDays).toBe(45);
  });

  it('falls back to updatedAt when no lastResponseOn', () => {
    const r = buildPcoVelocityReport({
      pcos: [
        pco({
          submittedOn: '2026-01-01',
          lastResponseOn: undefined,
          updatedAt: '2026-02-10T00:00:00Z', // 40 days
        }),
      ],
    });
    expect(r.blendedMeanDays).toBe(40);
  });

  it('rolls per agency', () => {
    const r = buildPcoVelocityReport({
      pcos: [
        pco({ id: '1', agencyContact: 'CalTrans Smith', submittedOn: '2026-01-01', lastResponseOn: '2026-02-01' }),
        pco({ id: '2', agencyContact: 'CalTrans Smith', submittedOn: '2026-02-01', lastResponseOn: '2026-03-15' }),
        pco({ id: '3', agencyContact: 'Cal Fire Jones', submittedOn: '2026-01-01', lastResponseOn: '2026-04-01' }),
      ],
    });
    const smith = r.byAgency.find((x) => x.agencyContact === 'CalTrans Smith')!;
    expect(smith.convertedCount).toBe(2);
    const jones = r.byAgency.find((x) => x.agencyContact === 'Cal Fire Jones')!;
    expect(jones.convertedCount).toBe(1);
  });

  it('rollup totalConvertedCents = sum of costImpactCents', () => {
    const r = buildPcoVelocityReport({
      pcos: [
        pco({ id: '1', costImpactCents: 10_000_00, submittedOn: '2026-01-01', lastResponseOn: '2026-02-01' }),
        pco({ id: '2', costImpactCents: 25_000_00, submittedOn: '2026-01-01', lastResponseOn: '2026-02-01' }),
      ],
    });
    expect(r.totalConvertedCents).toBe(35_000_00);
  });

  it('sorts byAgency slowest first', () => {
    const r = buildPcoVelocityReport({
      pcos: [
        pco({ id: '1', agencyContact: 'fast', submittedOn: '2026-01-01', lastResponseOn: '2026-01-08' }),  // 7d
        pco({ id: '2', agencyContact: 'slow', submittedOn: '2026-01-01', lastResponseOn: '2026-04-01' }),  // 90d
      ],
    });
    expect(r.byAgency[0]?.agencyContact).toBe('slow');
  });

  it('honors date range on submittedOn', () => {
    const r = buildPcoVelocityReport({
      start: '2026-04-01',
      end: '2026-04-30',
      pcos: [
        pco({ id: '1', submittedOn: '2026-03-01', lastResponseOn: '2026-04-01' }),  // out
        pco({ id: '2', submittedOn: '2026-04-15', lastResponseOn: '2026-05-15' }),  // in
      ],
    });
    expect(r.convertedConsidered).toBe(1);
  });

  it('groups missing agencyContact under Unknown', () => {
    const r = buildPcoVelocityReport({
      pcos: [
        pco({ id: '1', agencyContact: undefined, submittedOn: '2026-01-01', lastResponseOn: '2026-02-01' }),
      ],
    });
    expect(r.byAgency[0]?.agencyContact).toBe('Unknown');
  });
});
