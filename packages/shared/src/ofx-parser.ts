// OFX / QFX bank-statement parser (regex-based).
//
// Plain English: banks export account statements as OFX (or QFX,
// which is Intuit's OFX-with-a-license variant). Both formats hold
// transactions in <STMTTRN> blocks with the same field names. We
// match those with regex — no full SGML parser needed. This
// returns a list of parsed transactions ready to feed the existing
// bank-rec matcher.

export interface OfxTransaction {
  /** ISO yyyy-mm-dd of the posted date. */
  date: string;
  /** Free-form description (combined name + memo). */
  description: string;
  /** Integer cents, signed. Positive = credit/deposit; negative =
   *  debit/withdrawal. */
  amountCents: number;
  /** FI transaction id (FITID) — bank-side stable key. Useful for
   *  dedup across re-imports of overlapping statements. */
  fitId: string | null;
  /** Raw transaction type (CREDIT / DEBIT / CHECK / etc.) — useful
   *  for the bank-rec matcher to weigh AR-vs-AP candidates. */
  trnType: string | null;
}

export interface OfxParseResult {
  transactions: OfxTransaction[];
  bankAccountId: string | null;
  bankAccountType: string | null;
  statementStartDate: string | null;
  statementEndDate: string | null;
  ledgerBalanceCents: number | null;
}

function tag(re: RegExp, source: string): string | null {
  const m = re.exec(source);
  if (!m) return null;
  return m[1] ?? null;
}

function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null;
  // OFX dates are YYYYMMDD[HHMMSS][.fff][TZ]. We only care about the
  // calendar date.
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseOfxAmount(raw: string | null): number {
  if (!raw) return 0;
  const num = Number(raw.trim().replace(/,/g, ''));
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

/** Pull the inside of an OFX/SGML tag. The format isn't strictly
 *  XML — closing tags are often omitted on leaf nodes — so this
 *  matches an opening tag and reads to the next opening tag (or
 *  end-of-block). */
function leafValue(source: string, name: string): string | null {
  const re = new RegExp(`<${name}>([^<\\n]*)`, 'i');
  const m = re.exec(source);
  if (!m) return null;
  return m[1]?.trim() ?? null;
}

export function parseOfx(text: string): OfxParseResult {
  // Strip out any OFX/SGML header that precedes the actual data.
  const dataStart = text.indexOf('<OFX>');
  const body = dataStart >= 0 ? text.slice(dataStart) : text;

  // Account metadata is usually under <BANKACCTFROM> (or
  // <CCACCTFROM> for credit cards). Grab whichever is present.
  const acctBlock =
    tag(/<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i, body) ??
    tag(/<CCACCTFROM>([\s\S]*?)<\/CCACCTFROM>/i, body) ??
    '';
  const bankAccountId = leafValue(acctBlock, 'ACCTID');
  const bankAccountType = leafValue(acctBlock, 'ACCTTYPE');

  // Statement period.
  const bantransBlock =
    tag(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i, body) ?? '';
  const statementStartDate = parseOfxDate(
    leafValue(bantransBlock, 'DTSTART'),
  );
  const statementEndDate = parseOfxDate(leafValue(bantransBlock, 'DTEND'));

  const ledgerBlock =
    tag(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i, body) ?? '';
  const ledgerBalanceCents = ledgerBlock
    ? parseOfxAmount(leafValue(ledgerBlock, 'BALAMT'))
    : null;

  // Transactions. <STMTTRN>...</STMTTRN> blocks.
  const txns: OfxTransaction[] = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    const block = m[1] ?? '';
    const date = parseOfxDate(leafValue(block, 'DTPOSTED')) ?? '';
    const amountCents = parseOfxAmount(leafValue(block, 'TRNAMT'));
    const name = leafValue(block, 'NAME') ?? '';
    const memo = leafValue(block, 'MEMO') ?? '';
    const description = [name, memo].filter(Boolean).join(' · ').slice(0, 400);
    const fitId = leafValue(block, 'FITID');
    const trnType = leafValue(block, 'TRNTYPE');
    if (!date) continue;
    txns.push({
      date,
      description: description || '(no description)',
      amountCents,
      fitId,
      trnType,
    });
  }

  return {
    transactions: txns,
    bankAccountId,
    bankAccountType,
    statementStartDate,
    statementEndDate,
    ledgerBalanceCents,
  };
}
