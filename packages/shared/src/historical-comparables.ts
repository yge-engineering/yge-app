// Historical comparables — find prior YGE jobs that look like the
// current draft, so the estimator (and the Plans-to-Estimate AI)
// has a reality check before submitting a bid.
//
// The bigger arc Ryan picked is "rate tables + comparables". Rate
// tables shipped in bundle 169 (the YGE rate book is now in the
// AI's user message). This is the second half: given the current
// draft's project type, scope keywords, and region, rank past
// jobs by similarity so the UI can show "this draft looks like
// Powerline/Allbaugh ($3.1M, came in 1.1× the original bid) and
// Folsom Lift Station ($2.6M, came in 0.95× the bid)".
//
// Scoring (max 100):
//   Project type same      +50
//   Scope keyword overlap   0..30  (Jaccard similarity × 30)
//   County match           +20
//
// The score is a rough sort key, not a confidence number. Two
// jobs with the same score may still be very different — the
// estimator should always read the comparables, not just trust
// the ranking.
//
// What lives here:
//   - HistoricalJob shape (what a finished job looks like)
//   - findComparableJobs(draft, history) → ranked list with reasons
//   - bidVsActualVariance / bidVsLowVariance helpers so callers
//     can tell "this prior estimate was accurate" from "this
//     prior estimate missed by 4×"
//
// What does NOT live here:
//   - DB access (callers fetch HistoricalJob[] however they want)
//   - AI prompt integration (a later bundle wires the top-N
//     comparables into the Plans-to-Estimate user message)
//   - UI rendering (a later bundle adds the comparables panel to
//     /drafts/[id])

import type { PtoEProjectType } from './plans-to-estimate-output';

/** A past YGE bid that has enough history to be useful for compare.
 *  Most fields are nullable because old hand-keyed jobs may lack
 *  any one of them — the matcher tolerates partial data. */
export interface HistoricalJob {
  /** Stable ID — opaque to the matcher. */
  id: string;
  /** Human-readable name shown in the UI. */
  projectName: string;
  /** Owner/agency, optional, shown in the UI. */
  ownerAgency: string | null;
  projectType: PtoEProjectType;
  /** Lowercased single-word tags like "duct-bank", "trench", "pad". */
  scopeKeywords: string[];
  /** County name normalized to lowercase (e.g. "sacramento"). */
  countyName: string | null;
  /** Original bid total YGE submitted, in cents. */
  bidTotalCents: number;
  /** Actual final cost / contract value, in cents. Null if not tracked. */
  actualCostCents: number | null;
  /** Did we win this bid? */
  outcome: 'won' | 'lost' | 'unknown';
  /** Award spread, only populated when outcome != 'unknown'. */
  awardSpread: AwardSpread | null;
  /** One-liner the estimator left for future bids. */
  notesForFuture: string | null;
  /** ISO date the job was bid (NOT completed) — used for recency. */
  bidAt: string;
}

export interface AwardSpread {
  /** What YGE bid, in cents (same as bidTotalCents — repeated here
   *  because some callers only need the spread shape). */
  ours: number;
  /** Low bidder's amount in cents (may equal ours when we won). */
  low: number;
  /** YGE's rank — 1 = low bidder. */
  rank: number;
  /** How many bidders submitted. */
  bidderCount: number;
}

/** What the estimator (or the AI) supplies as "the current draft". */
export interface ComparableQuery {
  projectType: PtoEProjectType;
  scopeKeywords: string[];
  countyName: string | null;
}

export interface ComparableMatch {
  job: HistoricalJob;
  /** 0..100, rough sort key — see file header. */
  similarityScore: number;
  /** Plain-English bullets explaining the score. Suitable for UI. */
  reasons: string[];
}

export interface FindComparablesOptions {
  /** Cap on results (default 5). */
  maxResults?: number;
  /** Discard matches below this score (default 40). 40 = same
   *  project type alone is NOT enough; need some scope or region
   *  overlap to qualify. */
  minScore?: number;
}

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MIN_SCORE = 40;

const PROJECT_TYPE_POINTS = 50;
const COUNTY_POINTS = 20;
const SCOPE_OVERLAP_MAX_POINTS = 30;

/** Find prior jobs similar to the current draft, ranked best first.
 *
 *  Returns a possibly-empty array. Never throws — bad data is just
 *  scored low. */
export function findComparableJobs(
  query: ComparableQuery,
  history: HistoricalJob[],
  options: FindComparablesOptions = {},
): ComparableMatch[] {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const queryKeywords = normalizeKeywordSet(query.scopeKeywords);
  const queryCounty = query.countyName?.trim().toLowerCase() ?? null;

  const scored: ComparableMatch[] = [];
  for (const job of history) {
    const result = scoreOne(query, queryKeywords, queryCounty, job);
    if (result.similarityScore >= minScore) {
      scored.push(result);
    }
  }

  // Higher score first; ties broken by more-recent bid date.
  scored.sort((a, b) => {
    if (b.similarityScore !== a.similarityScore) {
      return b.similarityScore - a.similarityScore;
    }
    return b.job.bidAt.localeCompare(a.job.bidAt);
  });

  return scored.slice(0, maxResults);
}

function scoreOne(
  query: ComparableQuery,
  queryKeywords: Set<string>,
  queryCounty: string | null,
  job: HistoricalJob,
): ComparableMatch {
  let score = 0;
  const reasons: string[] = [];

  if (job.projectType === query.projectType) {
    score += PROJECT_TYPE_POINTS;
    reasons.push(`Same project type (${job.projectType.toLowerCase().replace(/_/g, ' ')})`);
  }

  const jobKeywords = normalizeKeywordSet(job.scopeKeywords);
  const jaccard = jaccardSimilarity(queryKeywords, jobKeywords);
  if (jaccard > 0) {
    const scopePoints = Math.round(jaccard * SCOPE_OVERLAP_MAX_POINTS);
    score += scopePoints;
    const overlap = [...queryKeywords].filter((k) => jobKeywords.has(k));
    if (overlap.length > 0) {
      const shown = overlap.slice(0, 3).join(', ');
      const more = overlap.length > 3 ? `, +${overlap.length - 3} more` : '';
      reasons.push(`Scope overlap: ${shown}${more}`);
    }
  }

  const jobCounty = job.countyName?.trim().toLowerCase() ?? null;
  if (queryCounty && jobCounty && queryCounty === jobCounty) {
    score += COUNTY_POINTS;
    reasons.push(`Same county (${capitalize(jobCounty)})`);
  }

  return { job, similarityScore: score, reasons };
}

function normalizeKeywordSet(keywords: ReadonlyArray<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of keywords) {
    const k = raw.trim().toLowerCase();
    if (k.length > 0) out.add(k);
  }
  return out;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- Variance helpers --------------------------------------------------
//
// Two separate questions:
//   1. "Was the original bid close to what the job actually cost?"
//      → bidVsActualVariance — tells you if our estimate was accurate
//   2. "Was the bid competitive on bid day?"
//      → bidVsLowVariance — tells you how aggressive the market was
// A comparable that's accurate on BOTH counts is the most trustworthy
// reference for the new draft. One that's wildly off on either is
// still useful — it's a cautionary tale.

export interface VarianceSummary {
  ratio: number;       // 1.0 = exact; >1 = over; <1 = under
  pctDeltaPercent: number; // signed, rounded to 1 decimal
  /** Plain-English label like "1.4× over original bid". */
  label: string;
}

export function bidVsActualVariance(job: HistoricalJob): VarianceSummary | null {
  if (job.actualCostCents === null) return null;
  if (job.bidTotalCents === 0) return null;
  return summarize(job.bidTotalCents, job.actualCostCents, 'original bid');
}

export function bidVsLowVariance(job: HistoricalJob): VarianceSummary | null {
  if (!job.awardSpread) return null;
  if (job.awardSpread.low === 0) return null;
  return summarize(job.awardSpread.low, job.awardSpread.ours, 'low bidder');
}

function summarize(
  baseCents: number,
  comparedCents: number,
  baseLabel: string,
): VarianceSummary {
  const ratio = comparedCents / baseCents;
  const pctDelta = (ratio - 1) * 100;
  const rounded = Math.round(pctDelta * 10) / 10;
  let label: string;
  if (Math.abs(rounded) < 0.05) {
    label = `Matched ${baseLabel} exactly`;
  } else if (rounded > 0) {
    label = `${ratio.toFixed(2)}× over ${baseLabel} (+${rounded.toFixed(1)}%)`;
  } else {
    label = `${ratio.toFixed(2)}× under ${baseLabel} (${rounded.toFixed(1)}%)`;
  }
  return { ratio, pctDeltaPercent: rounded, label };
}
