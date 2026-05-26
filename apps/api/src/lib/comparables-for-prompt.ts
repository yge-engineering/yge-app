// Past-YGE-jobs context for the Plans-to-Estimate prompt.
//
// The flagship example is Powerline/Allbaugh: when Ryan ran the
// v1 vision takeoff on a SMUD substation job, it returned an
// $814K bid. The job actually came in at $3.1M — a 4× miss. The
// AI didn't know that scope (transformer foundations, multi-
// conduit duct banks, oil containment, LIVE-site sequencing)
// usually burns way more crew-days than greenfield civil work
// of the same nominal LF/SF. Bundle 169 (rate book) gave it
// YGE's actual unit prices. This module hands it the prior
// jobs themselves so it has explicit, named reality checks.
//
// Format is intentionally short — the prompt already runs long
// once a 200-page plan set is attached. One paragraph per past
// job, lessons-learned note in plain English. The AI is
// instructed to think "is this draft about to repeat the same
// mistake?" before submitting.
//
// Lives in apps/api (not packages/shared) because (a) it's only
// consumed server-side and (b) the prompt-side framing is
// allowed to diverge from the UI-side comparables panel
// (apps/web/src/lib/yge-job-history-seed.ts). They share the
// same underlying facts, formatted for different audiences.

import type { PtoEProjectType } from '@yge/shared';

interface PromptComparable {
  /** Lowercased project-type hints — when a draft hint matches,
   *  this comparable always surfaces. Empty array = always
   *  applies (use sparingly). */
  matchProjectTypes: PtoEProjectType[];
  /** Lowercased keywords — when ANY appears in the document
   *  text, this comparable surfaces. */
  matchKeywords: string[];
  /** Plain-English paragraph the AI reads. */
  text: string;
}

// First-class comparables. Order matters — most-relevant first.
// Each entry's matchProjectTypes / matchKeywords decide whether
// it gets included for a given draft.
const COMPARABLES: PromptComparable[] = [
  {
    matchProjectTypes: ['OTHER'],
    matchKeywords: [
      'substation',
      'transformer',
      'duct bank',
      'duct-bank',
      'smud',
      'switchyard',
      'control house',
      'ground grid',
      'oil containment',
    ],
    text: [
      '**Powerline / Allbaugh Substation (SMUD, 2024)** — actual cost $3.1M, original v1 AI draft $814K (3.8× miss).',
      'Lessons:',
      '- SMUD furnishes NOTHING but the gate latches. Contractor buys ALL conduit, grounding, oil-containment liner, and concrete.',
      '- Substation duct banks are 4-conduit and 8-conduit configurations. Crew installs 15–80 LF/day, NOT the 200–400 LF/day rate for single-conduit trench. Use conduit-substation-ductbank-* production rates.',
      '- Transformer foundations are 2–7 crew-days EACH (forming + rebar + pour + cure + grout). Easy to miss when the bid schedule line is just "Foundation, EA".',
      '- Site is LIVE = energized switchyard. Schedule is 5–6 months, not 8 weeks. SITE_CONDITION should be LIVE, multiplier 1.7×.',
      '- CMU control-house walls and ground-grid trenches are usually on the drawings but NOT broken out in the bid schedule — price them anyway and flag as ASSUMPTION.',
    ].join('\n'),
  },
];

/** Pick the comparables that apply to this draft (by project-type hint
 *  + document keyword scan) and format them as a single text block
 *  the prompt can splice in. Returns empty string when nothing applies. */
export function loadComparablesForPrompt(input: {
  projectTypeHint?: PtoEProjectType;
  documentText?: string;
}): string {
  const docLower = (input.documentText ?? '').toLowerCase();
  const projectType = input.projectTypeHint;

  const selected = COMPARABLES.filter((c) => {
    const typeMatch =
      c.matchProjectTypes.length === 0 ||
      (projectType !== undefined && c.matchProjectTypes.includes(projectType));
    const kwMatch =
      c.matchKeywords.length === 0 ||
      c.matchKeywords.some((kw) => docLower.includes(kw));
    return typeMatch || kwMatch;
  });

  if (selected.length === 0) return '';

  return [
    '## YGE PAST-JOB COMPARABLES — READ BEFORE DRAFTING',
    '',
    'Before you submit a draft, check whether this job looks like one of the',
    'prior YGE jobs below. If it does, your unit prices, schedule, and scope',
    'list should reflect the lessons learned. A miss like Powerline/Allbaugh',
    '(3.8× over) usually traces to one of these blind spots.',
    '',
    ...selected.map((c) => c.text),
    '',
  ].join('\n');
}
