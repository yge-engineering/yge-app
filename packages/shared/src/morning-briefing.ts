// Daily morning briefing — what Brook reads before standing up the crew.
//
// Plain English: at 6am Brook needs to know what happened yesterday,
// who's on the dispatch board today, what safety items are open, and
// who hasn't paid us. Five sections, one page.
//
// Pure derivation — pulls from the existing daily-report, dispatch,
// incident, cert (employee+vendor), and AR invoice records. No new
// persisted records. Typically rendered to a printable so the
// foreman can take a paper copy out to the yard meet.

import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Employee } from './employee';
import type { Incident } from './incident';
import type { Vendor } from './vendor';
import { rowsFromEmployees, rowsFromVendors } from './cert-watchlist';
import { buildArAgingReport } from './aging';

export interface MorningBriefingTodayDispatch {
  jobId: string;
  foremanName: string;
  meetTime?: string;
  meetLocation?: string;
  crewCount: number;
  equipmentCount: number;
  scopeOfWork: string;
}

export interface MorningBriefingYesterdayReport {
  jobId: string;
  foremanId: string;
  weatherCondition?: string;
  temperatureF?: number;
  /** Foreman flagged anything in the issues field. */
  hasIssues: boolean;
  /** Crew hours total across the report's crew rows. */
  crewHours: number;
}

export interface MorningBriefingIncident {
  id: string;
  date: string;
  classification: string;
  outcome: string;
  daysOpen: number;
}

export interface MorningBriefingExpiring {
  who: string;
  certType: string;
  expiresOn: string;
  daysToExpiry: number;
}

export interface MorningBriefingArRow {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  daysOverdue: number;
  openCents: number;
}

export interface MorningBriefing {
  forDate: string;
  yesterdayDate: string;

  // Yesterday in review
  yesterdayReportCount: number;
  yesterdayReports: MorningBriefingYesterdayReport[];
  /** Job ids that had a posted dispatch yesterday but no submitted
   *  daily report — Brook needs to chase the foreman for it. */
  yesterdayMissingReports: string[];

  // Today on the board
  todayDispatches: MorningBriefingTodayDispatch[];

  // Safety + compliance
  openIncidents: MorningBriefingIncident[];
  expiringCerts: MorningBriefingExpiring[];

  // Money to chase
  oldestArInvoices: MorningBriefingArRow[];

  /** 0..5 short bullet-shaped strings — the items that need attention
   *  most. Order matters; first headline is the top priority. */
  headlines: string[];
}

export interface MorningBriefingInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  forDate?: string;
  dailyReports: DailyReport[];
  dispatches: Dispatch[];
  incidents: Incident[];
  employees: Employee[];
  vendors?: Vendor[];
  arInvoices: ArInvoice[];
  arPayments?: ArPayment[];
}

/** Build the morning briefing from existing records. */
export function buildMorningBriefing(
  inputs: MorningBriefingInputs,
): MorningBriefing {
  const forDate =
    inputs.forDate ?? new Date().toISOString().slice(0, 10);
  const yesterdayDate = addDaysIso(forDate, -1);

  // Yesterday's submitted daily reports.
  const yesterdayReports: MorningBriefingYesterdayReport[] = [];
  const reportedJobsYesterday = new Set<string>();
  for (const dr of inputs.dailyReports) {
    if (!dr.submitted) continue;
    if (dr.date !== yesterdayDate) continue;
    let crewMinutes = 0;
    for (const row of dr.crewOnSite ?? []) {
      crewMinutes += workedMinutes(
        row.startTime,
        row.endTime,
        row.lunchOut,
        row.lunchIn,
      );
    }
    yesterdayReports.push({
      jobId: dr.jobId,
      foremanId: dr.foremanId,
      weatherCondition: dr.weather,
      temperatureF: dr.temperatureF,
      hasIssues: !!(dr.issues && dr.issues.trim().length > 0),
      crewHours: Math.round((crewMinutes / 60) * 100) / 100,
    });
    reportedJobsYesterday.add(dr.jobId);
  }

  // Jobs dispatched yesterday but no daily report submitted.
  const dispatchedYesterday = new Set<string>();
  for (const d of inputs.dispatches) {
    if (d.scheduledFor !== yesterdayDate) continue;
    if (d.status === 'CANCELLED' || d.status === 'DRAFT') continue;
    dispatchedYesterday.add(d.jobId);
  }
  const yesterdayMissingReports = Array.from(dispatchedYesterday)
    .filter((j) => !reportedJobsYesterday.has(j))
    .sort();

  // Today on the board.
  const todayDispatches: MorningBriefingTodayDispatch[] = [];
  for (const d of inputs.dispatches) {
    if (d.scheduledFor !== forDate) continue;
    if (d.status === 'CANCELLED') continue;
    todayDispatches.push({
      jobId: d.jobId,
      foremanName: d.foremanName,
      meetTime: d.meetTime,
      meetLocation: d.meetLocation,
      crewCount: (d.crew ?? []).length,
      equipmentCount: (d.equipment ?? []).length,
      scopeOfWork: d.scopeOfWork,
    });
  }
  todayDispatches.sort((a, b) => a.jobId.localeCompare(b.jobId));

  // Open safety incidents.
  const openIncidents: MorningBriefingIncident[] = [];
  for (const inc of inputs.incidents) {
    if (inc.status !== 'OPEN') continue;
    const daysOpen = Math.max(0, daysBetween(inc.incidentDate, forDate));
    openIncidents.push({
      id: inc.id,
      date: inc.incidentDate,
      classification: inc.classification,
      outcome: inc.outcome,
      daysOpen,
    });
  }
  openIncidents.sort((a, b) => b.daysOpen - a.daysOpen);

  // Cert expirations within 30 days (employees + vendor COIs).
  const refNow = parseUtc(forDate);
  const empRows = rowsFromEmployees(inputs.employees, refNow);
  const vendorRows = inputs.vendors ? rowsFromVendors(inputs.vendors, refNow) : [];
  const expiringCerts: MorningBriefingExpiring[] = [...empRows, ...vendorRows]
    .filter((r) => r.daysUntilExpiry <= 30 && r.daysUntilExpiry >= -7)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .map((r) => ({
      who: r.subjectName,
      certType: r.itemLabel,
      expiresOn: r.expiresOn,
      daysToExpiry: r.daysUntilExpiry,
    }));

  // Oldest AR invoices (top 5 most overdue).
  const aging = buildArAgingReport({
    asOf: forDate,
    arInvoices: inputs.arInvoices,
  });
  const oldestArInvoices: MorningBriefingArRow[] = aging.rows
    .filter((r) => r.daysOverdue > 0)
    .slice(0, 5)
    .map((r) => ({
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoiceNumber,
      customerName: r.partyName,
      daysOverdue: r.daysOverdue,
      openCents: r.openCents,
    }));

  // Headlines — most action-worthy items first.
  const headlines: string[] = [];

  // 1. Missing yesterday daily reports.
  if (yesterdayMissingReports.length > 0) {
    headlines.push(
      `${yesterdayMissingReports.length} ${plural('foreman', 'foremen', yesterdayMissingReports.length)} owe yesterday's daily report.`,
    );
  }

  // 2. Open Cal/OSHA reportable incidents (death or days-away).
  const reportable = openIncidents.filter(
    (i) => i.outcome === 'DEATH' || i.outcome === 'DAYS_AWAY',
  );
  if (reportable.length > 0) {
    headlines.push(
      `${reportable.length} open serious-injury ${plural('case', 'cases', reportable.length)} — Cal/OSHA reportable.`,
    );
  }

  // 3. Imminent cert expirations (today/past).
  const imminent = expiringCerts.filter((c) => c.daysToExpiry <= 7);
  if (imminent.length > 0) {
    headlines.push(
      `${imminent.length} ${plural('cert', 'certs', imminent.length)} expiring this week.`,
    );
  }

  // 4. AR over 60 days.
  const stale = oldestArInvoices.filter((r) => r.daysOverdue >= 60);
  if (stale.length > 0) {
    const total = stale.reduce((s, r) => s + r.openCents, 0);
    headlines.push(
      `${stale.length} AR ${plural('invoice', 'invoices', stale.length)} 60+ days overdue (${formatCentsCompact(total)} on the table).`,
    );
  }

  // 5. Today's dispatch headcount.
  if (todayDispatches.length > 0) {
    const totalCrew = todayDispatches.reduce((s, d) => s + d.crewCount, 0);
    headlines.push(
      `${totalCrew} ${plural('crew member', 'crew members', totalCrew)} dispatched across ${todayDispatches.length} ${plural('job', 'jobs', todayDispatches.length)} today.`,
    );
  }

  return {
    forDate,
    yesterdayDate,
    yesterdayReportCount: yesterdayReports.length,
    yesterdayReports,
    yesterdayMissingReports,
    todayDispatches,
    openIncidents,
    expiringCerts,
    oldestArInvoices,
    headlines,
  };
}

// ---- helpers ------------------------------------------------------

function workedMinutes(
  start: string,
  end: string,
  lunchOut: string | undefined,
  lunchIn: string | undefined,
): number {
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s == null || e == null) return 0;
  let total = e - s;
  if (total < 0) total += 24 * 60; // shift across midnight
  const lo = parseHHMM(lunchOut ?? null);
  const li = parseHHMM(lunchIn ?? null);
  if (lo != null && li != null && li > lo) total -= li - lo;
  return Math.max(0, total);
}

function parseHHMM(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function addDaysIso(yyyymmdd: string, days: number): string {
  const t = Date.parse(`${yyyymmdd}T00:00:00Z`);
  if (Number.isNaN(t)) return yyyymmdd;
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.floor((t - f) / (24 * 60 * 60 * 1000));
}

function parseUtc(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd}T00:00:00Z`);
}

function plural(s: string, p: string, n: number): string {
  return n === 1 ? s : p;
}

function formatCentsCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(0)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}
