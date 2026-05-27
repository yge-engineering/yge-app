// /comparables/export.json — download the YGE_JOB_HISTORY_SEED as JSON.
//
// Companion to /comparables/export.csv. The JSON form preserves
// the full schema (scopeKeywords as an array, awardSpread null,
// templateflag computed on the fly) so a programmatic consumer
// can round-trip without re-parsing CSV.

import { YGE_JOB_HISTORY_SEED } from '../../../lib/yge-job-history-seed';

export function GET() {
  const rows = YGE_JOB_HISTORY_SEED.map((j) => ({
    ...j,
    isTemplate:
      j.id.startsWith('template-') || j.projectName.startsWith('TEMPLATE'),
  }));

  return new Response(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: rows.length,
        comparables: rows,
      },
      null,
      2,
    ) + '\n',
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition':
          'attachment; filename="yge-comparables-seed.json"',
        'Cache-Control': 'no-store',
      },
    },
  );
}
