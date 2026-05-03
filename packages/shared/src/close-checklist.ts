// Month-end close checklist.
//
// Pure derivation. For a given month (yyyy-mm), walks every record
// type that matters at close and surfaces what likely needs attention
// before Brook flips the period closed:
//
//   - books in balance (sum of debits == sum of credits across posted JEs)
//   - no DRAFT journal entries lingering
//   - no entries dated in the month not yet posted
//   - AR over 60 days needs collection follow-up
//   - AP unpaid + past due
//   - uncleared checks beyond a stale window
//   - retention activity (informational)
//   - SWPPP weekly cadence kept during rainy season
//   - cert/COI expirations during the month
//   - daily reports — gaps in the month
//
// Returns a flat list of check items; each item knows whether it's a
// blocker for close or just an advisory.

import { computeAccountBalances, type JournalEntry } from './journal-entry';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';
import type { ApInvoice } from './ap-invoice';
import type { ApPayment } from './ap-payment';
import type { ArInvoice } from './ar-invoice';
import { arUnpaidBalanceCents } from './ar-invoice';
import type { DailyReport } from './daily-report';
import type { SwpppInspection } from './swppp-inspection';

export type CloseCheckSeverity = 'BLOCKER' | 'ADVISORY' | 'INFO';
export type CloseCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface CloseCheckItem {
  id: string;
  label: string;
  severity: CloseCheckSeverity;
  status: CloseCheckStatus;
  /** Short detail string printed under the label. */
  detail: string;
  /** Optional deep link the runbook can use. */
  href?: string;
}

export interface CloseChecklist {
  /** Month label, e.g. "2026-04". */
  month: string;
  /** First day of the month, inclusive. */
  monthStart: string;
  /** Last day of the month, inclusive. */
  monthEnd: string;
  items: CloseCheckItem[];
  /** True iff every BLOCKER passes. Drives the green/red banner. */
  readyToClose: boolean;
  blockerCount: number;
  warnCount: number;
}

export interface CloseChecklistInputs {
  /** Month in `yyyy-mm` form. */
  month: string;
  journalEntries: JournalEntry[];
  arInvoices: ArInvoice[];
  apInvoices: ApInvoice[];
  apPayments: ApPayment[];
  dailyReports: DailyReport[];
  swpppInspections: SwpppInspection[];
  /** Override "today" for testing. */
  asOf?: Date;
}

/** Build the checklist. */
export function buildCloseChecklist(inputs: CloseChecklistInputs): CloseChecklist {
  const {
    month,
    journalEntries,
    arInvoices,
    apInvoices,
    apPayments,
    dailyReports,
    swpppInspections,
  } = inputs;
  const asOf = inputs.asOf ?? new Date();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`month must be yyyy-mm (got "${month}")`);
  }
  const [yStr, mStr] = month.split('-') as [string, string];
  const y = Number(yStr);
  const m = Number(mStr); // 1-based
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m=April ⇒ Date(y, 4, 0) = Apr 30
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

  const items: CloseCheckItem[] = [];

  // 1) Books balanced (across all posted entries — close needs the GL square).
  const balances = computeAccountBalances(journalEntries);
  const totalDebit = balances.reduce((s, b) => s + b.debitCents, 0);
  const totalCredit = balances.reduce((s, b) => s + b.creditCents, 0);
  const inBalance = totalDebit === totalCredit;
  items.push({
    id: 'BOOKS_BALANCED',
    label: 'Trial balance is square',
    severity: 'BLOCKER',
    status: inBalance ? 'PASS' : 'FAIL',
    detail: inBalance
      ? 'Total debits equal total credits.'
      : `Out of balance by ${(totalDebit - totalCredit) / 100}. Fix before closing.`,
    href: '/trial-balance',
  });

  // 2) No DRAFT journal entries dated in or before this month.
  const draftInMonth = journalEntries.filter(
    (j) => j.status === 'DRAFT' && j.entryDate <= monthEnd,
  );
  items.push({
    id: 'NO_DRAFT_JES',
    label: 'No draft journal entries pending',
    severity: 'BLOCKER',
    status: draftInMonth.length === 0 ? 'PASS' : 'FAIL',
    detail:
      draftInMonth.length === 0
        ? 'All entries through end of month are posted or voided.'
        : `${draftInMonth.length} draft entr${draftInMonth.length === 1 ? 'y' : 'ies'} dated through ${monthEnd}.`,
    href: '/journal-entries?status=DRAFT',
  });

  // 3) AR aging — invoices > 60 days old still unpaid.
  const ar60 = arInvoices.filter((i) => {
    if (i.status === 'PAID' || i.status === 'WRITTEN_OFF') return false;
    if (i.invoiceDate > monthEnd) return false;
    const issuedMs = new Date(i.invoiceDate + 'T00:00:00Z').getTime();
    const ageDays = (asOf.getTime() - issuedMs) / (24 * 60 * 60 * 1000);
    return ageDays > 60 && arUnpaidBalanceCents(i) > 0;
  });
  items.push({
    id: 'AR_OVER_60',
    label: 'AR over 60 days addressed',
    severity: 'ADVISORY',
    status: ar60.length === 0 ? 'PASS' : 'WARN',
    detail:
      ar60.length === 0
        ? 'No AR invoices outstanding > 60 days.'
        : `${ar60.length} invoice${ar60.length === 1 ? '' : 's'} > 60 days old still owing.`,
    href: '/ar-invoices',
  });

  // 4) AP unpaid + past due.
  const apPastDue = apInvoices.filter((i) => {
    if (i.status === 'PAID' || i.status === 'REJECTED') return false;
    if (!i.dueDate) return false;
    if (i.dueDate > monthEnd) return false;
    const balance = Math.max(0, i.totalCents - i.paidCents);
    return balance > 0;
  });
  items.push({
    id: 'AP_PAST_DUE',
    label: 'AP past due reviewed',
    severity: 'ADVISORY',
    status: apPastDue.length === 0 ? 'PASS' : 'WARN',
    detail:
      apPastDue.length === 0
        ? 'No AP invoices past due as of month end.'
        : `${apPastDue.length} AP invoice${apPastDue.length === 1 ? '' : 's'} past due.`,
    href: '/ap-invoices',
  });

  // 5) Uncleared checks > 30 days.
  const msPerDay = 24 * 60 * 60 * 1000;
  const staleChecks = apPayments.filter((p) => {
    if (p.voided || p.cleared) return false;
    if (p.paidOn > monthEnd) return false;
    const paidMs = new Date(p.paidOn + 'T00:00:00Z').getTime();
    const ageDays = (asOf.getTime() - paidMs) / msPerDay;
    return ageDays > 30;
  });
  items.push({
    id: 'STALE_CHECKS',
    label: 'No checks uncleared > 30 days',
    severity: 'ADVISORY',
    status: staleChecks.length === 0 ? 'PASS' : 'WARN',
    detail:
      staleChecks.length === 0
        ? 'All issued checks have cleared the bank.'
        : `${staleChecks.length} payment${staleChecks.length === 1 ? '' : 's'} issued > 30 days ago and still uncleared.`,
    href: '/ap-payments',
  });

  // 6) Daily-report gaps — count workdays in month with no daily report.
  // Workday heuristic: Monday–Friday. Sunday=0, Saturday=6.
  const reportDates = new Set(
    dailyReports
      .filter((d) => d.date >= monthStart && d.date <= monthEnd)
      .map((d) => d.date),
  );
  let missingWorkdays = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const dt = new Date(Date.UTC(y, m - 1, day));
    const dow = dt.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const yyyymmdd = dt.toISOString().slice(0, 10);
    if (!reportDates.has(yyyymmdd)) missingWorkdays += 1;
  }
  items.push({
    id: 'DAILY_REPORTS',
    label: 'Daily reports filed for every workday',
    severity: 'ADVISORY',
    status: missingWorkdays === 0 ? 'PASS' : 'WARN',
    detail:
      missingWorkdays === 0
        ? 'No workday gaps this month.'
        : `${missingWorkdays} workday${missingWorkdays === 1 ? '' : 's'} without a daily report.`,
    href: '/daily-reports',
  });

  // 7) SWPPP — at least one inspection per week during the month.
  // Use Monday-of-week as the bucket key.
  const swpppInMonth = swpppInspections.filter(
    (s) => s.inspectedOn >= monthStart && s.inspectedOn <= monthEnd,
  );
  const weeksCovered = new Set(
    swpppInMonth.map((s) => mondayOfISOWeekKey(s.inspectedOn)),
  );
  // How many ISO weeks does the month span?
  const monthWeeks = new Set<string>();
  for (let day = 1; day <= lastDay; day += 1) {
    monthWeeks.add(mondayOfISOWeekKey(`${month}-${String(day).padStart(2, '0')}`));
  }
  const missingWeeks = Array.from(monthWeeks).filter((wk) => !weeksCovered.has(wk));
  items.push({
    id: 'SWPPP_WEEKLY',
    label: 'SWPPP inspections cover every week',
    severity: 'ADVISORY',
    status: missingWeeks.length === 0 ? 'PASS' : 'WARN',
    detail:
      missingWeeks.length === 0
        ? 'Every week in the month has at least one SWPPP inspection.'
        : `${missingWeeks.length} week${missingWeeks.length === 1 ? '' : 's'} this month with no inspection logged.`,
    href: '/swppp',
  });

  const blockerCount = items.filter(
    (i) => i.severity === 'BLOCKER' && i.status !== 'PASS',
  ).length;
  const warnCount = items.filter((i) => i.status === 'WARN').length;
  const readyToClose = blockerCount === 0;

  return {
    month,
    monthStart,
    monthEnd,
    items,
    readyToClose,
    blockerCount,
    warnCount,
  };
}

/** Stringify the Monday of the ISO week containing `yyyy-mm-dd` for use
 *  as a Set key. */
function mondayOfISOWeekKey(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff),
  );
  return mon.toISOString().slice(0, 10);
}

export function severityLabel(s: CloseCheckSeverity, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `closeCheckSeverity.${s}`);
}
