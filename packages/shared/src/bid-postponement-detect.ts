// Bid-postponement detector.
//
// When an agency moves a bid opening date — usually because an addendum
// was issued late or a clarification dropped — they send an email with
// language like "bid opening postponed to [new date]" or "due date
// extended". Missing one of those costs YGE the bid: we either show up
// at the old time and find an empty room, or we miss the new deadline
// because nobody saw the email.
//
// This detector runs over inbound email triage results before they're
// queued so a hit forces the message to the top of the triage list and
// surfaces a "Bid date changed — review" chip in the UI.
//
// Plain regex + keyword heuristic, no AI call. Tunable threshold so
// the email-triage stage can decide whether to act on a low-confidence
// match or just flag it.

/** Result of the detector. */
export interface BidPostponementResult {
  /** True iff the heuristic crossed the confidence threshold (>= 0.5). */
  detected: boolean;
  /** 0–1 confidence score. 0.9+ when we have BOTH a postponement phrase
   *  AND a new date parsed. 0.6 when just the phrase. 0.0 when neither. */
  confidence: number;
  /** ISO yyyy-mm-dd if a new date was parsed; undefined otherwise. */
  newDate?: string;
  /** Free-form one-liner the UI can surface to the user — first phrase
   *  hit, lightly normalized. */
  reasonText?: string;
  /** Tokens the heuristic matched. Useful for the "why did this fire?"
   *  tooltip + for tuning the regex set. */
  matchedSignals: string[];
}

export interface BidPostponementInput {
  subject?: string;
  body?: string;
}

/** Phrases that strongly indicate the agency is moving an open/due
 *  date. Lowercased substring match. Order doesn't matter, but
 *  shorter phrases match more aggressively, so put them last for
 *  precision. */
const STRONG_PHRASES = [
  'bid opening postponed',
  'bid opening rescheduled',
  'bid opening moved',
  'bid opening extended',
  'bid opening date has been moved',
  'bid opening date has been changed',
  'bid opening date is now',
  'bid date extended',
  'bid date moved',
  'due date extended',
  'due date has been extended',
  'due date has changed',
  'due date moved',
  'new bid date',
  'revised bid date',
  'revised bid opening',
  'postponement of bid',
  'rescheduling of bid',
];

const WEAK_PHRASES = [
  'addendum no. 2',
  'addendum no. 3',
  'addendum 2',
  'addendum 3',
  'revised schedule',
  'new opening date',
  'updated bid date',
];

/** Crude ISO-date / US-date / written-date matcher. We're scanning
 *  English agency boilerplate, so the most common formats are:
 *
 *    2026-06-15   (rare from agencies but estimators paste it in)
 *    6/15/2026
 *    06/15/2026
 *    June 15, 2026
 *    June 15 2026
 *
 *  Returns the FIRST plausible future date found. "Future" means
 *  >= today, but the function doesn't know today — that filtering is
 *  the caller's job. The matcher only normalizes to yyyy-mm-dd. */
function extractFirstDate(text: string): string | undefined {
  // ISO
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // US numeric: 6/15/2026 or 06/15/2026
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (us) {
    const m = us[1]!.padStart(2, '0');
    const d = us[2]!.padStart(2, '0');
    return `${us[3]}-${m}-${d}`;
  }
  // Written month: June 15, 2026
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };
  const written = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})\b/i,
  );
  if (written) {
    const monthKey = written[1]!.toLowerCase();
    const month = months[monthKey];
    if (month) {
      const day = written[2]!.padStart(2, '0');
      return `${written[3]}-${month}-${day}`;
    }
  }
  return undefined;
}

export function detectBidPostponement(
  input: BidPostponementInput,
): BidPostponementResult {
  const subject = (input.subject ?? '').toLowerCase();
  const body = (input.body ?? '').toLowerCase();
  const haystack = `${subject}\n${body}`;

  const strongHits = STRONG_PHRASES.filter((p) => haystack.includes(p));
  const weakHits = WEAK_PHRASES.filter((p) => haystack.includes(p));

  if (strongHits.length === 0 && weakHits.length === 0) {
    return { detected: false, confidence: 0, matchedSignals: [] };
  }

  const newDate = extractFirstDate(`${input.subject ?? ''} ${input.body ?? ''}`);

  // Score:
  //   strong + date    → 0.95
  //   strong only      → 0.65
  //   weak  + date     → 0.55
  //   weak only        → 0.30 (below threshold — caller usually ignores)
  let confidence = 0;
  if (strongHits.length > 0 && newDate) confidence = 0.95;
  else if (strongHits.length > 0) confidence = 0.65;
  else if (weakHits.length > 0 && newDate) confidence = 0.55;
  else confidence = 0.3;

  const matchedSignals = [...strongHits.slice(0, 2), ...weakHits.slice(0, 2)];
  const reasonText =
    strongHits[0] ?? weakHits[0] ?? undefined;

  return {
    detected: confidence >= 0.5,
    confidence,
    newDate,
    reasonText,
    matchedSignals,
  };
}
