// Scope-keyword dictionary + extractor.
//
// Drives the comparables matcher: given the text of a draft
// (bid items + assumptions + project name joined), pulls
// known heavy-civil scope keywords so we can score similarity
// against historical jobs in YGE_JOB_HISTORY_SEED.
//
// Tiny dictionary on purpose — every entry should be specific
// enough that hits are meaningful, not vague noun-matches.
// Use case-insensitive substring matching with a hyphen↔space
// fallback so 'duct-bank' matches both 'duct-bank' and
// 'duct bank' in the source text.
//
// Previously lived in apps/web/src/lib/yge-job-history-seed.ts.
// Promoted to shared so the API can use the same extraction
// when injecting comparables into the AI prompt and so the
// extractor can have tests (the web app does not have vitest
// configured).

export const SCOPE_KEYWORD_DICTIONARY = [
  'asphalt',
  'paving',
  'tack-coat',
  'concrete',
  'curb',
  'sidewalk',
  'ada-ramp',
  'pad',
  'foundation',
  'transformer-foundation',
  'conduit',
  'duct-bank',
  'trench',
  'pipe',
  'sewer',
  'storm',
  'culvert',
  'manhole',
  'headwall',
  'energy-dissipator',
  'rcb',
  'rcp',
  'hdpe',
  'pvc',
  'aggregate',
  'rock',
  'base',
  'riprap',
  'fill',
  'cut',
  'export',
  'import',
  'grading',
  'clearing',
  'topsoil',
  'compaction',
  'subgrade',
  'demolition',
  'striping',
  'signage',
  'guardrail',
  'fence',
  'gate',
  'erosion',
  'swppp',
  'control-house',
  'cmu-wall',
  'masonry',
  'ground-grid',
  'oil-containment',
  'substation',
  'bridge',
  'abutment',
  'pier',
  'deck',
  'culvert-extension',
  'falsework',
  'mastication',
  'burn-pile',
  'fuel-break',
] as const;

export type ScopeKeyword = (typeof SCOPE_KEYWORD_DICTIONARY)[number];

/** Pull lowercased scope keywords out of a draft's bid-item
 *  descriptions (or any free text). Hyphenated dictionary
 *  entries also match the space-separated form (e.g. 'duct-bank'
 *  matches 'duct bank'). */
export function extractScopeKeywordsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const k of SCOPE_KEYWORD_DICTIONARY) {
    const spaceForm = k.replace(/-/g, ' ');
    if (lower.includes(k) || lower.includes(spaceForm)) {
      found.add(k);
    }
  }
  return [...found];
}
