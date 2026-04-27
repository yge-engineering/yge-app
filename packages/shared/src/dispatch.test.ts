import { describe, expect, it } from 'vitest';
import {
  computeDispatchRollup,
  detectDoubleBookings,
  type Dispatch,
} from './dispatch';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    jobId: 'job-2026-01-01-test-aaaaaaaa',
    scheduledFor: '2026-04-25',
    foremanName: 'Brook Young',
    scopeOfWork: 'Set forms station 12+50',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  };
}

describe('detectDoubleBookings', () => {
  it('returns no conflicts when each resource is on one dispatch per day', () => {
    const a = disp({
      id: 'disp-11111111',
      crew: [{ name: 'Jane Doe', signed: false } as any],
    });
    const b = disp({
      id: 'disp-22222222',
      jobId: 'job-2026-01-01-other-bbbbbbbb',
      crew: [{ name: 'John Smith' } as any],
    });
    expect(detectDoubleBookings([a, b])).toHaveLength(0);
  });

  it('flags a crew member assigned to two dispatches on the same day', () => {
    const a = disp({
      id: 'disp-11111111',
      crew: [{ name: 'Jane Doe' } as any],
    });
    const b = disp({
      id: 'disp-22222222',
      jobId: 'job-2026-01-01-other-bbbbbbbb',
      crew: [{ name: 'Jane Doe' } as any],
    });
    const conflicts = detectDoubleBookings([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('CREW');
    expect(conflicts[0]?.name).toBe('Jane Doe');
    expect(conflicts[0]?.dispatchIds).toEqual(['disp-11111111', 'disp-22222222']);
  });

  it('flags equipment double-booking by equipmentId', () => {
    const a = disp({
      id: 'disp-11111111',
      equipment: [{ equipmentId: 'eq-aaa', name: 'CAT 320E' } as any],
    });
    const b = disp({
      id: 'disp-22222222',
      jobId: 'job-2026-01-01-other-bbbbbbbb',
      equipment: [{ equipmentId: 'eq-aaa', name: 'Excavator' } as any],
    });
    const conflicts = detectDoubleBookings([a, b]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('EQUIPMENT');
  });

  it('ignores cancelled dispatches', () => {
    const a = disp({
      id: 'disp-11111111',
      crew: [{ name: 'Jane Doe' } as any],
    });
    const b = disp({
      id: 'disp-22222222',
      status: 'CANCELLED',
      crew: [{ name: 'Jane Doe' } as any],
    });
    expect(detectDoubleBookings([a, b])).toHaveLength(0);
  });

  it('does not flag the same person on different days', () => {
    const a = disp({
      id: 'disp-11111111',
      scheduledFor: '2026-04-25',
      crew: [{ name: 'Jane Doe' } as any],
    });
    const b = disp({
      id: 'disp-22222222',
      scheduledFor: '2026-04-26',
      crew: [{ name: 'Jane Doe' } as any],
    });
    expect(detectDoubleBookings([a, b])).toHaveLength(0);
  });
});

describe('computeDispatchRollup', () => {
  it('counts today crew + equipment headcount', () => {
    const r = computeDispatchRollup(
      [
        disp({
          id: 'disp-11111111',
          scheduledFor: '2026-04-25',
          crew: [{ name: 'A' } as any, { name: 'B' } as any],
          equipment: [{ name: 'CAT 320E' } as any],
        }),
        disp({
          id: 'disp-22222222',
          scheduledFor: '2026-04-25',
          crew: [{ name: 'C' } as any],
          equipment: [],
        }),
        disp({
          id: 'disp-33333333',
          scheduledFor: '2026-04-26',
          crew: [{ name: 'D' } as any],
        }),
      ],
      '2026-04-25',
    );
    expect(r.todayCount).toBe(2);
    expect(r.todayCrewHeadcount).toBe(3);
    expect(r.todayEquipmentCount).toBe(1);
  });
});
