import { describe, it, expect } from 'vitest';

import {
  compareWageDecisions,
  type WageDecisionLine,
} from './davis-bacon-wage';

const caPwd = (base: number, fringe: number, label = 'CA PWD'): WageDecisionLine => ({
  hourlyBaseCents: base,
  hourlyFringeCents: fringe,
  sourceLabel: label,
});

describe('compareWageDecisions', () => {
  it('returns CA PWD when its total is higher', () => {
    const r = compareWageDecisions(
      caPwd(60_00, 30_00, 'CA PWD Operator Group 4'),
      caPwd(50_00, 25_00, 'Davis-Bacon CA-30 2025-05'),
    );
    expect(r.controllingSource).toBe('ca-pwd');
    expect(r.controllingTotalCents).toBe(90_00);
    expect(r.reason).toMatch(/CA PWD controls/);
    expect(r.reason).toMatch(/\$90\.00\/hr/);
  });

  it('returns Davis-Bacon when its total is higher', () => {
    const r = compareWageDecisions(
      caPwd(50_00, 25_00, 'CA PWD'),
      caPwd(60_00, 30_00, 'Davis-Bacon'),
    );
    expect(r.controllingSource).toBe('davis-bacon');
    expect(r.controllingTotalCents).toBe(90_00);
    expect(r.reason).toMatch(/Davis-Bacon controls/);
  });

  it('reports tie when both totals match', () => {
    const r = compareWageDecisions(
      caPwd(60_00, 30_00),
      caPwd(60_00, 30_00),
    );
    expect(r.controllingSource).toBe('tie');
    expect(r.controllingTotalCents).toBe(90_00);
    expect(r.reason).toMatch(/match/);
  });

  it('still preserves source labels in tie', () => {
    const r = compareWageDecisions(
      caPwd(60_00, 30_00, 'CA PWD Carpenter'),
      caPwd(60_00, 30_00, 'Davis-Bacon Carpenter'),
    );
    expect(r.sources.caPwd).toBe('CA PWD Carpenter');
    expect(r.sources.davisBacon).toBe('Davis-Bacon Carpenter');
  });

  it('handles base-only decisions (zero fringe)', () => {
    const r = compareWageDecisions(
      caPwd(45_00, 0),
      caPwd(40_00, 0),
    );
    expect(r.controllingSource).toBe('ca-pwd');
    expect(r.controllingTotalCents).toBe(45_00);
  });

  it('handles fringe-only decisions (zero base — should not happen but...)', () => {
    const r = compareWageDecisions(
      caPwd(0, 30_00),
      caPwd(0, 25_00),
    );
    expect(r.controllingSource).toBe('ca-pwd');
    expect(r.controllingTotalCents).toBe(30_00);
  });
});
