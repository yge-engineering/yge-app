import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildVendorPunchDetailSnapshot } from './vendor-punch-detail-snapshot';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Sta. 12+50',
    description: 'X',
    severity: 'MINOR',
    status: 'OPEN',
    responsibleParty: 'Granite',
    ...over,
  } as PunchItem;
}

describe('buildVendorPunchDetailSnapshot', () => {
  it('returns one row per job sorted by open', () => {
    const r = buildVendorPunchDetailSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      punchItems: [
        pi({ id: 'a', jobId: 'j1', responsibleParty: 'Granite', status: 'OPEN', severity: 'SAFETY', dueOn: '2026-04-20' }),
        pi({ id: 'b', jobId: 'j1', responsibleParty: 'GRANITE LLC', status: 'CLOSED', severity: 'MINOR' }),
        pi({ id: 'c', jobId: 'j2', responsibleParty: 'Granite Inc.', status: 'IN_PROGRESS', severity: 'MAJOR', dueOn: '2026-05-15' }),
        pi({ id: 'd', jobId: 'j1', responsibleParty: 'Other', status: 'OPEN', severity: 'MINOR' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.open).toBe(1);
    expect(r.rows[0]?.closed).toBe(1);
    expect(r.rows[0]?.overdue).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.major).toBe(1);
    expect(r.rows[1]?.overdue).toBe(0);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorPunchDetailSnapshot({ vendorName: 'X', punchItems: [] });
    expect(r.rows.length).toBe(0);
  });
});
