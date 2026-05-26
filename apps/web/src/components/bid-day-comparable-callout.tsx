// BidDayComparableCallout — final reality-check on bid day. Compact
// version of /drafts/[id]'s ComparableJobsPanel. Shows the TOP
// historical match only, and only when the score is ≥60. If
// nothing's close enough to warrant attention, renders nothing
// (no noise on the cockpit).
//
// On bid day Ryan's already adjusted unit prices, picked subs,
// signed the bid bond — this is the last "wait, is this draft
// about to repeat the Powerline/Allbaugh mistake?" moment before
// the envelope goes out.

import {
  bidVsActualVariance,
  findComparableJobs,
  formatUSD,
  type PricedEstimate,
} from '@yge/shared';

import {
  YGE_JOB_HISTORY_SEED,
  extractScopeKeywordsFromText,
} from '../lib/yge-job-history-seed';

interface Props {
  estimate: PricedEstimate;
}

/** Parse "Sacramento County, CA" → "sacramento". Returns null for
 *  any input that doesn't fit the "X County, ..." pattern, which is
 *  fine — county-less matches just lose 20 points and may still
 *  qualify on project type + scope alone. */
function countyFromLocation(loc: string | undefined): string | null {
  if (!loc) return null;
  const m = loc.match(/\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+County\b/i);
  const captured = m?.[1];
  if (!captured) return null;
  return captured.trim().toLowerCase();
}

export function BidDayComparableCallout({ estimate }: Props) {
  const scopeText = [
    estimate.projectName,
    ...estimate.bidItems.map((i) => i.description),
  ].join(' \n ');
  const scopeKeywords = extractScopeKeywordsFromText(scopeText);
  const county = countyFromLocation(estimate.location);

  const matches = findComparableJobs(
    {
      projectType: estimate.projectType,
      scopeKeywords,
      countyName: county,
    },
    [...YGE_JOB_HISTORY_SEED],
    { maxResults: 1, minScore: 60 },
  );

  if (matches.length === 0) return null;
  const match = matches[0];
  if (!match) return null;
  const { job } = match;
  const actualV = bidVsActualVariance(job);

  // Tone-mapped color: anything 25%+ off the original bid renders
  // as a "watch out" callout; tighter matches as a neutral note.
  const isCautionary =
    actualV !== null && Math.abs(actualV.pctDeltaPercent) >= 25;
  const wrapperClass = isCautionary
    ? 'border-red-300 bg-red-50 text-red-900'
    : 'border-blue-300 bg-blue-50 text-blue-900';

  return (
    <section className={`mt-4 rounded-lg border p-4 text-sm ${wrapperClass}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-semibold">
          {isCautionary ? '⚠ Reality check: ' : 'Past comparable: '}
          {job.projectName}
        </div>
        <div className="text-xs">
          {match.similarityScore}% match · Bid{' '}
          {formatUSD(job.bidTotalCents, { compact: true })}
          {job.actualCostCents !== null && (
            <>
              {' '}
              · Actual {formatUSD(job.actualCostCents, { compact: true })}
            </>
          )}
        </div>
      </div>
      {actualV && (
        <div className="mt-1 text-xs font-semibold">{actualV.label}</div>
      )}
      {job.notesForFuture && (
        <p className="mt-2 text-xs">
          <span className="font-semibold">Lessons:</span> {job.notesForFuture}
        </p>
      )}
    </section>
  );
}
