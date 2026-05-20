// QuickBooks export value parsing — money + dates.
//
// QBO CSV exports format money as "$1,234.56", "1,234.56", or "(123.45)"
// for negatives, and dates as "MM/DD/YYYY" (sometimes "M/D/YY"). Our models
// store money as integer cents and dates as ISO "yyyy-mm-dd". These two
// helpers do that normalization for every transactional importer.

/**
 * Parse a QuickBooks money string to integer cents.
 *
 *   "$1,234.56" -> 123456
 *   "1234.5"    -> 123450
 *   "(50.00)"   -> -5000   (accounting parens = negative)
 *   "-50"       -> -5000
 *   ""  / "—"   -> null
 *
 * Returns null when the value is blank or not a number.
 */
export function parseQboAmountToCents(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  let s = raw.trim();
  if (s.length === 0 || s === '-' || s === '—') return null;

  // Accounting-style negatives: (123.45)
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1).trim();
  }

  // Strip currency symbol, thousands separators, and spaces.
  s = s.replace(/[$,\s]/g, '');
  if (s.length === 0) return null;
  if (!/^\d*\.?\d+$|^\d+\.?\d*$/.test(s)) return null;

  const dollars = Number(s);
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  return negative ? -cents : cents;
}

/**
 * Parse a QuickBooks date string to ISO "yyyy-mm-dd".
 *
 *   "03/15/2026" -> "2026-03-15"
 *   "3/5/26"     -> "2026-03-05"
 *   "2026-03-15" -> "2026-03-15"  (pass-through)
 *
 * Two-digit years map to 2000-2099 (QBO migration data is recent). Returns
 * null for blank or unrecognized input. Does NOT validate that the day
 * exists in the month (a downstream Zod regex catches gross garbage).
 */
export function parseQboDate(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  const s = raw.trim();
  if (s.length === 0) return null;

  // Already ISO.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;

  // US slash or dash separated: M/D/Y or M-D-Y.
  const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (m[3]!.length === 2) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
