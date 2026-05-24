// Toolbox talk topic rotation.
//
// Plain English: California requires weekly safety meetings (commonly
// called toolbox talks or tailgate safety meetings) for construction
// crews. The same topic every week loses everyone's attention, and
// missing the annually-required topics (heat illness, struck-by,
// trench shoring) leaves Cal/OSHA exposure on the next inspection.
//
// This helper takes the crew's recent talk history + the standard
// rotation list and recommends the next topic by gap-since-last-given,
// so the foreman picks a topic that's been the longest unaddressed.
// Mandatory topics get a yearly boost — even when one was given 30
// days ago, if it's the annual heat-illness refresher month (May–Sept
// in NorCal), it gets prioritized.

import { addDays, type CalDate } from './california-holidays';

/** Standard toolbox-talk topic catalog. Each topic carries a tag for
 *  optional callouts ("HEAT_ILLNESS" → flagged Apr-Oct). */
export interface ToolboxTopic {
  id: string;
  /** Plain-English title that prints on the sign-in sheet. */
  title: string;
  /** Optional category for filtering / annual-cadence boost. */
  category?:
    | 'HEAT_ILLNESS'
    | 'STRUCK_BY'
    | 'TRENCH'
    | 'PPE'
    | 'EQUIPMENT'
    | 'TRAFFIC_CONTROL'
    | 'HAZARD_COMM'
    | 'EMERGENCY_ACTION'
    | 'OTHER';
  /** True iff Cal/OSHA mandates this topic at least annually. The
   *  recommender prioritizes mandatory topics that haven't been
   *  covered in 11+ months. */
  mandatoryAnnually?: boolean;
}

/** Default Cal/OSHA-aligned topic library. Caller can pass their
 *  own to override. */
export const DEFAULT_TOPIC_LIBRARY: ToolboxTopic[] = [
  { id: 'heat-illness', title: 'Heat illness prevention (T8 §3395)', category: 'HEAT_ILLNESS', mandatoryAnnually: true },
  { id: 'trench-shoring', title: 'Trench shoring + 5-foot rule (T8 §1541)', category: 'TRENCH', mandatoryAnnually: true },
  { id: 'struck-by-vehicles', title: 'Struck-by — vehicles + equipment swing radius', category: 'STRUCK_BY', mandatoryAnnually: true },
  { id: 'hazard-communication', title: 'Hazard communication + SDS access', category: 'HAZARD_COMM', mandatoryAnnually: true },
  { id: 'ppe-inspection', title: 'PPE inspection — hard hats / vests / boots', category: 'PPE' },
  { id: 'fall-protection', title: 'Fall protection — embankment + tied-off above 6 ft', category: 'PPE' },
  { id: 'traffic-control-flagger', title: 'Traffic control + flagger safety', category: 'TRAFFIC_CONTROL' },
  { id: 'equipment-pretrip', title: 'Equipment pre-trip + circle check', category: 'EQUIPMENT' },
  { id: 'lockout-tagout', title: 'Lockout/tagout (T8 §3314)', category: 'EQUIPMENT', mandatoryAnnually: true },
  { id: 'emergency-action', title: 'Emergency action plan + evacuation routes', category: 'EMERGENCY_ACTION', mandatoryAnnually: true },
  { id: 'silica-respirable', title: 'Respirable silica exposure (cutting/grinding)', category: 'PPE', mandatoryAnnually: true },
  { id: 'electrical-overhead', title: 'Overhead power line clearance', category: 'EQUIPMENT' },
];

export interface ToolboxTalkHistoryEntry {
  topicId: string;
  date: CalDate;
}

export interface RecommendToolboxInput {
  /** Crew's recent talk history. Order doesn't matter — the helper
   *  picks the most-recent date per topic. */
  history: ToolboxTalkHistoryEntry[];
  /** Today (yyyy-mm-dd). Used for gap math + seasonal boosts. */
  asOfDate: CalDate;
  /** Override the topic library; defaults to DEFAULT_TOPIC_LIBRARY. */
  library?: ToolboxTopic[];
}

export interface ToolboxRecommendation {
  topic: ToolboxTopic;
  /** Days since the crew last did this topic. Number.POSITIVE_INFINITY
   *  when never done. */
  daysSinceLast: number;
  /** Score used to rank — higher = pick this one. */
  score: number;
  /** Plain-English reason that goes in the tooltip. */
  reason: string;
}

/** Pick the next toolbox topic to give the crew. Returns ALL topics
 *  ranked descending — the caller usually shows top 3. */
export function recommendToolboxRotation(
  input: RecommendToolboxInput,
): ToolboxRecommendation[] {
  const lib = input.library ?? DEFAULT_TOPIC_LIBRARY;
  // Most-recent date per topic id.
  const lastDate = new Map<string, CalDate>();
  for (const h of input.history) {
    const prev = lastDate.get(h.topicId);
    if (!prev || h.date > prev) lastDate.set(h.topicId, h.date);
  }

  // Heat-illness boost during NorCal hot months (May 1 – Sep 30).
  // (Cal/OSHA T8 §3395 enforcement steps up when temps exceed 80°F.)
  const month = Number(input.asOfDate.slice(5, 7));
  const heatSeason = month >= 5 && month <= 9;

  const recs: ToolboxRecommendation[] = lib.map((topic) => {
    const last = lastDate.get(topic.id);
    const days =
      last === undefined
        ? Number.POSITIVE_INFINITY
        : daysBetweenCal(last, input.asOfDate);
    let score = isFinite(days) ? days : 365 * 2; // never-done = big number
    let reason = isFinite(days)
      ? `Last given ${days} day${days === 1 ? '' : 's'} ago.`
      : 'Never given.';
    if (topic.mandatoryAnnually && days >= 330) {
      score += 200;
      reason += ' Mandatory annually — overdue.';
    }
    if (topic.category === 'HEAT_ILLNESS' && heatSeason) {
      score += 150;
      reason += ' Heat season — give early + often.';
    }
    return { topic, daysSinceLast: days, score, reason };
  });

  recs.sort((a, b) => b.score - a.score);
  return recs;
}

/** Days from a to b. Negative if a > b. */
function daysBetweenCal(a: CalDate, b: CalDate): number {
  const aMs = new Date(a + 'T00:00:00Z').getTime();
  const bMs = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((bMs - aMs) / (1000 * 60 * 60 * 24));
}

// Re-export addDays from CA holidays for callers that want to
// schedule out a rotation but don't need the full module import.
export { addDays };
