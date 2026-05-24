// Coverage for the job startup checklist generator.

import { describe, it, expect } from 'vitest';
import { buildJobStartupChecklist } from './job-startup-checklist';
import { classifyOwnerAgency } from './owner-agency';

const caltransClass = classifyOwnerAgency({
  ownerName: 'California Department of Transportation',
});

const calFireClass = classifyOwnerAgency({
  ownerName: 'CAL FIRE',
});

const privateClass = classifyOwnerAgency({
  ownerName: 'Foothill Acres LLC',
  documentText: 'private development industrial',
});

const usfsClass = classifyOwnerAgency({
  ownerName: 'USDA Forest Service — Shasta-Trinity NF',
});

describe('buildJobStartupChecklist', () => {
  it('Caltrans road job emits DAS-140, §4104, SWPPP, bonds, traffic-control', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'ROAD_RECONSTRUCTION',
      classification: caltransClass,
      hasListedSubs: true,
      awardedAmountCents: 5_000_000_00, // $5M
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).toContain('das-140');
    expect(ids).toContain('sub-list-to-agency');
    expect(ids).toContain('swppp');
    expect(ids).toContain('bonds');
    expect(ids).toContain('traffic-control-plan');
    expect(cl.hasCriticalItems).toBe(true);
  });

  it('Forest Service job includes Davis-Bacon WD but NOT §4104 sub list', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'FIRE_FUEL_REDUCTION',
      classification: usfsClass,
      hasListedSubs: true,
      awardedAmountCents: 800_000_00,
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).toContain('davis-bacon-wd');
    expect(ids).not.toContain('sub-list-to-agency'); // federal direct
    expect(ids).toContain('cal-fire-fire-watch');    // FFR-specific
  });

  it('private job skips PW + DAS-140 + sub-list + Davis-Bacon', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'GRADING',
      classification: privateClass,
      hasListedSubs: false,
      awardedAmountCents: 250_000_00,
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).not.toContain('das-140');
    expect(ids).not.toContain('sub-list-to-agency');
    expect(ids).not.toContain('davis-bacon-wd');
    expect(ids).not.toContain('pw-fringe-update');
    // Bonds still required at $250K (above the $25K threshold).
    expect(ids).toContain('bonds');
  });

  it('skips bonds when award amount is under $25K', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'OTHER',
      classification: privateClass,
      hasListedSubs: false,
      awardedAmountCents: 2_000_00, // $2,000
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).not.toContain('bonds');
  });

  it('keeps bonds when awardedAmountCents is undefined (precaution)', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'OTHER',
      classification: privateClass,
      hasListedSubs: false,
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).toContain('bonds');
  });

  it('always emits IIPP + insurance + JSA day-1 items', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'OTHER',
      classification: privateClass,
      hasListedSubs: false,
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).toContain('iipp-job-specific');
    expect(ids).toContain('jsa-initial');
    expect(ids).toContain('insurance-cert');
    expect(ids).toContain('usa-dig');
  });

  it('FFR-only fire-watch item does NOT appear on road work', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'ROAD_RECONSTRUCTION',
      classification: caltransClass,
      hasListedSubs: true,
      awardedAmountCents: 1_000_000_00,
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).not.toContain('cal-fire-fire-watch');
  });

  it('CAL FIRE FFR job pulls in the fire-watch item', () => {
    const cl = buildJobStartupChecklist({
      projectType: 'FIRE_FUEL_REDUCTION',
      classification: calFireClass,
      hasListedSubs: true,
      awardedAmountCents: 600_000_00,
    });
    const ids = cl.items.map((i) => i.id);
    expect(ids).toContain('cal-fire-fire-watch');
    expect(ids).toContain('das-140'); // CA state contract
    expect(ids).toContain('sub-list-to-agency');
  });
});
