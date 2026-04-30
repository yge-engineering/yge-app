import { describe, expect, it } from 'vitest';

import type { PunchItem } from './punch-list';

import { buildPortfolioPunchYoy } from './portfolio-punch-yoy';

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Bay 1',
    description: 'Test',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildPortfolioPunchYoy', () => {
  it('counts identified + closed across years', () => {
    const r = buildPortfolioPunchYoy({
      currentYear: 2026,
      punchItems: [
        pi({ id: 'a', identifiedOn: '2025-04-15', closedOn: '2026-04-15' }),
        pi({ id: 'b', identifiedOn: '2026-04-15' }),
      ],
    });
    expect(r.priorIdentified).toBe(1);
    expect(r.currentIdentified).toBe(1);
    expect(r.currentClosed).toBe(1);
    expect(r.identifiedDelta).toBe(0);
    expect(r.closedDelta).toBe(1);
  });

  it('breaks identified down by severity', () => {
    const r = buildPortfolioPunchYoy({
      currentYear: 2026,
      punchItems: [
        pi({ id: 'a', severity: 'SAFETY' }),
        pi({ id: 'b', severity: 'MAJOR' }),
        pi({ id: 'c', severity: 'MAJOR' }),
        pi({ id: 'd', severity: 'MINOR' }),
      ],
    });
    expect(r.currentIdentifiedBySeverity.SAFETY).toBe(1);
    expect(r.currentIdentifiedBySeverity.MAJOR).toBe(2);
    expect(r.currentIdentifiedBySeverity.MINOR).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioPunchYoy({ currentYear: 2026, punchItems: [] });
    expect(r.currentIdentified).toBe(0);
  });
});
