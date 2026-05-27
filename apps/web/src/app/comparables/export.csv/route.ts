// /comparables/export.csv — download the YGE_JOB_HISTORY_SEED as CSV.
//
// Static today (reads the in-repo seed). When the seed flips to
// a DB-backed query, this route fetches from /api instead.
// Columns mirror what /comparables shows on screen plus a
// template flag and the lessons-learned note so the CSV is
// useful as a standalone reference for Brook / consultants /
// the surety agent.

import {
  bidVsActualVariance,
  bidVsLowVariance,
  formatUSD,
} from '@yge/shared';

import { YGE_JOB_HISTORY_SEED } from '../../../lib/yge-job-history-seed';

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function GET() {
  const rows: string[] = [
    [
      'id',
      'projectName',
      'ownerAgency',
      'projectType',
      'countyName',
      'bidTotalUSD',
      'actualCostUSD',
      'bidVsActualVariance',
      'bidVsLowVariance',
      'scopeKeywords',
      'bidAt',
      'outcome',
      'isTemplate',
      'notesForFuture',
    ].join(','),
  ];

  for (const job of YGE_JOB_HISTORY_SEED) {
    const isTemplate =
      job.id.startsWith('template-') || job.projectName.startsWith('TEMPLATE');
    const actualV = bidVsActualVariance(job);
    const lowV = bidVsLowVariance(job);
    rows.push(
      [
        csvEscape(job.id),
        csvEscape(job.projectName),
        csvEscape(job.ownerAgency ?? ''),
        csvEscape(job.projectType),
        csvEscape(job.countyName ?? ''),
        csvEscape(formatUSD(job.bidTotalCents, { compact: false })),
        csvEscape(
          job.actualCostCents !== null
            ? formatUSD(job.actualCostCents, { compact: false })
            : '',
        ),
        csvEscape(actualV?.label ?? ''),
        csvEscape(lowV?.label ?? ''),
        csvEscape(job.scopeKeywords.join('; ')),
        csvEscape(job.bidAt ?? ''),
        csvEscape(job.outcome),
        csvEscape(isTemplate ? 'true' : 'false'),
        csvEscape(job.notesForFuture ?? ''),
      ].join(','),
    );
  }

  const csv = rows.join('\n') + '\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="yge-comparables-seed.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
