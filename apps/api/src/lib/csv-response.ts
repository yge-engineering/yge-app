// Helpers for emitting text/csv responses from list endpoints.
//
// Each module's GET-list route opts in by calling `maybeCsv(req, res, rows,
// columns, filename)` after computing the rows. If the request specifies
// `?format=csv`, we send text/csv with a Content-Disposition; otherwise
// we return false and the caller proceeds with its normal JSON response.

import type { Request, Response } from 'express';
import { objectsToCsv } from '@yge/shared';

export interface CsvColumn<T> {
  header: string;
  get: (row: T) => string | number | undefined | null;
}

/** If the request has `?format=csv`, write a CSV response and return true.
 *  Otherwise return false and let the caller emit JSON normally. */
export function maybeCsv<T>(
  req: Request,
  res: Response,
  rows: T[],
  columns: ReadonlyArray<CsvColumn<T>>,
  filenameStem: string,
): boolean {
  if (req.query.format !== 'csv') return false;
  const csv = objectsToCsv(rows, columns);
  // BOM lets Excel auto-detect UTF-8 instead of mojibake'ing names with
  // accents (foreman names, county names, etc).
  const body = '\uFEFF' + csv;
  const today = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filenameStem}-${today}.csv"`,
  );
  res.status(200).send(body);
  return true;
}
