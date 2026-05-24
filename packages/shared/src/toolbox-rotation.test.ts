// Coverage for the toolbox talk rotation recommender.

import { describe, it, expect } from 'vitest';
import {
  recommendToolboxRotation,
  DEFAULT_TOPIC_LIBRARY,
  type ToolboxTopic,
} from './toolbox-rotation';

describe('recommendToolboxRotation', () => {
  it('prioritizes never-given topics over recently-given ones', () => {
    const recs = recommendToolboxRotation({
      asOfDate: '2026-03-15',
      history: [
        { topicId: 'heat-illness', date: '2026-03-10' },
        { topicId: 'trench-shoring', date: '2026-03-03' },
      ],
    });
    // None of the other 10+ topics have history → they rank higher
    // than the two recently-covered ones.
    expect(recs[0]!.daysSinceLast).toBe(Number.POSITIVE_INFINITY);
    // heat-illness was given 5 days ago, in March (not heat season)
    // → ranks low.
    const heat = recs.find((r) => r.topic.id === 'heat-illness')!;
    expect(heat.daysSinceLast).toBe(5);
  });

  it('boosts heat-illness during NorCal heat season (May-Sep)', () => {
    // Two scenarios — same history, March vs July as-of dates.
    const history = [{ topicId: 'heat-illness', date: '2026-06-15' }];
    const inMarch = recommendToolboxRotation({
      asOfDate: '2026-03-15',
      history: [{ topicId: 'heat-illness', date: '2026-03-10' }],
    });
    const inJuly = recommendToolboxRotation({
      asOfDate: '2026-07-15',
      history,
    });
    const heatJuly = inJuly.find((r) => r.topic.id === 'heat-illness')!;
    const heatMarch = inMarch.find((r) => r.topic.id === 'heat-illness')!;
    expect(heatJuly.reason).toContain('Heat season');
    expect(heatMarch.reason).not.toContain('Heat season');
  });

  it('flags annually-mandatory topics as overdue past 330 days', () => {
    const recs = recommendToolboxRotation({
      asOfDate: '2026-12-01',
      history: [
        // Trench shoring last given 11+ months ago.
        { topicId: 'trench-shoring', date: '2025-12-15' },
      ],
    });
    const trench = recs.find((r) => r.topic.id === 'trench-shoring')!;
    expect(trench.daysSinceLast).toBe(351);
    expect(trench.reason).toContain('Mandatory annually');
  });

  it('uses the most-recent date when multiple history entries exist', () => {
    const recs = recommendToolboxRotation({
      asOfDate: '2026-05-15',
      history: [
        { topicId: 'ppe-inspection', date: '2025-12-01' }, // old
        { topicId: 'ppe-inspection', date: '2026-05-01' }, // recent
      ],
    });
    const ppe = recs.find((r) => r.topic.id === 'ppe-inspection')!;
    expect(ppe.daysSinceLast).toBe(14);
  });

  it('respects a custom topic library', () => {
    const lib: ToolboxTopic[] = [
      { id: 'custom-1', title: 'YGE-specific topic A' },
      { id: 'custom-2', title: 'YGE-specific topic B' },
    ];
    const recs = recommendToolboxRotation({
      asOfDate: '2026-05-15',
      history: [],
      library: lib,
    });
    expect(recs).toHaveLength(2);
    expect(recs.every((r) => r.topic.id.startsWith('custom-'))).toBe(true);
  });

  it('default library carries the Cal/OSHA-mandated core topics', () => {
    const ids = DEFAULT_TOPIC_LIBRARY.map((t) => t.id);
    expect(ids).toContain('heat-illness');
    expect(ids).toContain('trench-shoring');
    expect(ids).toContain('struck-by-vehicles');
    expect(ids).toContain('hazard-communication');
    expect(ids).toContain('lockout-tagout');
  });
});
