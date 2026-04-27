import { describe, expect, it } from 'vitest';
import { buildToolboxComplianceReport } from './toolbox-compliance';
import type { ToolboxTalk } from './toolbox-talk';

function tbt(over: Partial<ToolboxTalk>): ToolboxTalk {
  return {
    id: 'tbt-1',
    createdAt: '',
    updatedAt: '',
    heldOn: '2026-04-13',
    topic: 'Heat illness',
    leaderName: 'Bob',
    attendees: [],
    status: 'HELD',
    ...over,
  } as ToolboxTalk;
}

describe('buildToolboxComplianceReport', () => {
  it('counts only HELD + SUBMITTED inside the period', () => {
    const r = buildToolboxComplianceReport({
      start: '2026-04-01',
      end: '2026-04-30',
      toolboxTalks: [
        tbt({ id: 'a', heldOn: '2026-04-05', status: 'DRAFT' }),     // skip
        tbt({ id: 'b', heldOn: '2026-04-05', status: 'HELD' }),
        tbt({ id: 'c', heldOn: '2026-04-12', status: 'SUBMITTED' }),
        tbt({ id: 'd', heldOn: '2026-03-31', status: 'HELD' }),      // out of period
      ],
    });
    expect(r.talksHeld).toBe(2);
  });

  it('computes workingDays + talksRequired (Apr 2026 = 22 / 10 = 2)', () => {
    const r = buildToolboxComplianceReport({
      start: '2026-04-01',
      end: '2026-04-30',
      toolboxTalks: [],
    });
    expect(r.workingDays).toBe(22);
    expect(r.talksRequired).toBe(2);
  });

  it('compliant=true when at least one talk per 10-workday window', () => {
    // April 2026 has 22 working days. Two windows of 10 + one trailing.
    const r = buildToolboxComplianceReport({
      start: '2026-04-01',
      end: '2026-04-30',
      toolboxTalks: [
        tbt({ id: 'a', heldOn: '2026-04-03' }),
        tbt({ id: 'b', heldOn: '2026-04-17' }),
        tbt({ id: 'c', heldOn: '2026-04-29' }),
      ],
    });
    expect(r.compliant).toBe(true);
    expect(r.nonCompliantWindowCount).toBe(0);
  });

  it('compliant=false with a 10-workday gap', () => {
    const r = buildToolboxComplianceReport({
      start: '2026-04-01',
      end: '2026-04-30',
      toolboxTalks: [
        // First window has a talk; later windows do not.
        tbt({ id: 'a', heldOn: '2026-04-03' }),
      ],
    });
    expect(r.compliant).toBe(false);
    expect(r.nonCompliantWindowCount).toBeGreaterThan(0);
  });

  it('compliant=false when total talks below required even if windows clear', () => {
    // Force a long period (3 months = ~63 workdays = 6 required) with
    // only 1 talk total — total fails even though one window has it.
    const r = buildToolboxComplianceReport({
      start: '2026-04-01',
      end: '2026-06-30',
      toolboxTalks: [tbt({ id: 'a', heldOn: '2026-04-03' })],
    });
    expect(r.compliant).toBe(false);
  });

  it('per-attendee participation surfaces who keeps missing', () => {
    const r = buildToolboxComplianceReport({
      start: '2026-04-01',
      end: '2026-04-30',
      toolboxTalks: [
        tbt({
          id: 'a',
          heldOn: '2026-04-05',
          attendees: [
            { name: 'Bob', employeeId: 'emp-bob', signed: true } as never,
            { name: 'Alice', employeeId: 'emp-alice', signed: true } as never,
          ],
        }),
        tbt({
          id: 'b',
          heldOn: '2026-04-15',
          attendees: [
            { name: 'Bob', employeeId: 'emp-bob', signed: true } as never,
          ],
        }),
        tbt({
          id: 'c',
          heldOn: '2026-04-25',
          attendees: [
            { name: 'Bob', employeeId: 'emp-bob', signed: true } as never,
            { name: 'Alice', employeeId: 'emp-alice', signed: true } as never,
          ],
        }),
      ],
    });
    // Bob attended 3/3, Alice 2/3 — Alice surfaces above Bob (worse rate)
    expect(r.attendees[0]?.name).toBe('Alice');
    expect(r.attendees[0]?.attendanceRate).toBeCloseTo(2 / 3, 4);
    expect(r.attendees[1]?.attendanceRate).toBe(1);
  });

  it('groups same-name attendees with no employeeId by lowercase name', () => {
    const r = buildToolboxComplianceReport({
      start: '2026-04-01',
      end: '2026-04-30',
      toolboxTalks: [
        tbt({
          id: 'a',
          heldOn: '2026-04-05',
          attendees: [{ name: 'Sub Worker', signed: true } as never],
        }),
        tbt({
          id: 'b',
          heldOn: '2026-04-15',
          attendees: [{ name: 'sub worker', signed: true } as never], // case-insensitive
        }),
      ],
    });
    expect(r.attendees).toHaveLength(1);
    expect(r.attendees[0]?.meetingsAttended).toBe(2);
  });
});
