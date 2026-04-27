// Photo log evidence index.
//
// Plain English: field photos are claim evidence — delay days backed
// by weather, incident photos linked to OSHA cases, change-order
// justification, SWPPP BMP inspections. This module rolls the photo
// log into one searchable index and cross-references each photo
// against the weather log + daily reports + incidents that happened
// the same day on the same job. The result is a "this photo is part
// of [N] related records" badge on each row, plus filters for the
// most common evidence-packet pulls.
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Incident } from './incident';
import type { Photo, PhotoCategory } from './photo';
import type { WeatherLog } from './weather-log';

export interface PhotoEvidenceRow {
  /** Echo the photo fields the UI prints. */
  id: string;
  jobId: string;
  takenOn: string;
  takenAt: string | undefined;
  location: string;
  caption: string;
  photographerName: string | undefined;
  category: PhotoCategory;
  reference: string;
  hasGps: boolean;
  latitude: number | undefined;
  longitude: number | undefined;

  /** Cross-references from the photo record itself. */
  linkedRfiId?: string;
  linkedChangeOrderId?: string;
  linkedIncidentId?: string;
  linkedPunchItemId?: string;
  linkedDailyReportId?: string;
  linkedSwpppInspectionId?: string;

  /** Cross-references derived by date+job match. */
  weatherSameDay: boolean;
  /** Same as above but only when weather was severe enough to be
   *  delay evidence (rain, snow, high wind, extreme heat, etc.). */
  weatherDelayCandidate: boolean;
  dailyReportSameDay: boolean;
  incidentSameDay: boolean;

  /** Total non-null cross-references — drives the "evidence-rich"
   *  badge on the row. */
  evidenceLinkCount: number;
}

export interface PhotoEvidenceCounts {
  total: number;
  byCategory: Record<PhotoCategory, number>;
  withGps: number;
  withWeatherSameDay: number;
  withDelayCandidate: number;
  withIncidentSameDay: number;
}

export interface PhotoEvidenceInputs {
  /** ISO yyyy-mm-dd inclusive. Both optional → no date filter. */
  start?: string;
  end?: string;
  /** Optional jobId filter. */
  jobId?: string;
  /** Optional category filter. */
  category?: PhotoCategory;
  /** Optional GPS-only filter (require latitude + longitude). */
  requireGps?: boolean;

  photos: Photo[];
  weatherLog?: WeatherLog[];
  dailyReports?: DailyReport[];
  incidents?: Incident[];
}

export interface PhotoEvidenceReport {
  rows: PhotoEvidenceRow[];
  counts: PhotoEvidenceCounts;
}

export function buildPhotoEvidenceIndex(
  inputs: PhotoEvidenceInputs,
): PhotoEvidenceReport {
  const start = inputs.start;
  const end = inputs.end;
  const jobIdFilter = inputs.jobId;
  const categoryFilter = inputs.category;
  const requireGps = inputs.requireGps === true;

  // Index lookups by (jobId|date) for fast cross-reference.
  const weatherByKey = new Map<string, WeatherLog>();
  for (const w of inputs.weatherLog ?? []) {
    weatherByKey.set(`${w.jobId}|${w.observedOn}`, w);
  }
  const dailyByKey = new Map<string, DailyReport>();
  for (const d of inputs.dailyReports ?? []) {
    if (!d.submitted) continue;
    dailyByKey.set(`${d.jobId}|${d.date}`, d);
  }
  const incidentsByKey = new Map<string, Incident>();
  for (const inc of inputs.incidents ?? []) {
    incidentsByKey.set(`${inc.jobId ?? ''}|${inc.incidentDate}`, inc);
  }

  const rows: PhotoEvidenceRow[] = [];
  for (const p of inputs.photos) {
    if (start && p.takenOn < start) continue;
    if (end && p.takenOn > end) continue;
    if (jobIdFilter && p.jobId !== jobIdFilter) continue;
    if (categoryFilter && p.category !== categoryFilter) continue;
    const hasGps =
      typeof p.latitude === 'number' && typeof p.longitude === 'number';
    if (requireGps && !hasGps) continue;

    const key = `${p.jobId}|${p.takenOn}`;
    const weather = weatherByKey.get(key);
    const dr = dailyByKey.get(key);
    const inc = incidentsByKey.get(key);

    const weatherSameDay = !!weather;
    const weatherDelayCandidate = !!weather && isDelayWeather(weather);
    const dailyReportSameDay = !!dr;
    const incidentSameDay = !!inc;

    let evidenceLinkCount = 0;
    if (p.rfiId) evidenceLinkCount += 1;
    if (p.changeOrderId) evidenceLinkCount += 1;
    if (p.incidentId) evidenceLinkCount += 1;
    if (p.punchItemId) evidenceLinkCount += 1;
    if (p.dailyReportId) evidenceLinkCount += 1;
    if (p.swpppInspectionId) evidenceLinkCount += 1;
    if (weatherSameDay) evidenceLinkCount += 1;
    if (dailyReportSameDay && !p.dailyReportId) evidenceLinkCount += 1;
    if (incidentSameDay && !p.incidentId) evidenceLinkCount += 1;

    rows.push({
      id: p.id,
      jobId: p.jobId,
      takenOn: p.takenOn,
      takenAt: p.takenAt,
      location: p.location,
      caption: p.caption,
      photographerName: p.photographerName,
      category: p.category,
      reference: p.reference,
      hasGps,
      latitude: p.latitude,
      longitude: p.longitude,
      linkedRfiId: p.rfiId,
      linkedChangeOrderId: p.changeOrderId,
      linkedIncidentId: p.incidentId,
      linkedPunchItemId: p.punchItemId,
      linkedDailyReportId: p.dailyReportId,
      linkedSwpppInspectionId: p.swpppInspectionId,
      weatherSameDay,
      weatherDelayCandidate,
      dailyReportSameDay,
      incidentSameDay,
      evidenceLinkCount,
    });
  }

  // Sort: most evidence-rich first, then most-recent date first, then
  // job + caption alphabetical so the order is stable.
  rows.sort((a, b) => {
    if (a.evidenceLinkCount !== b.evidenceLinkCount) {
      return b.evidenceLinkCount - a.evidenceLinkCount;
    }
    if (a.takenOn !== b.takenOn) return b.takenOn.localeCompare(a.takenOn);
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.caption.localeCompare(b.caption);
  });

  // Counts.
  const byCategory: Record<PhotoCategory, number> = {
    PROGRESS: 0,
    PRE_CONSTRUCTION: 0,
    DELAY: 0,
    CHANGE_ORDER: 0,
    SWPPP: 0,
    INCIDENT: 0,
    PUNCH: 0,
    COMPLETION: 0,
    OTHER: 0,
  };
  let withGps = 0;
  let withWeatherSameDay = 0;
  let withDelayCandidate = 0;
  let withIncidentSameDay = 0;
  for (const r of rows) {
    byCategory[r.category] += 1;
    if (r.hasGps) withGps += 1;
    if (r.weatherSameDay) withWeatherSameDay += 1;
    if (r.weatherDelayCandidate) withDelayCandidate += 1;
    if (r.incidentSameDay) withIncidentSameDay += 1;
  }

  return {
    rows,
    counts: {
      total: rows.length,
      byCategory,
      withGps,
      withWeatherSameDay,
      withDelayCandidate,
      withIncidentSameDay,
    },
  };
}

/** Heuristic for "this weather day was bad enough to support a
 *  delay claim." */
function isDelayWeather(w: WeatherLog): boolean {
  if (w.impact === 'STOPPED' || w.impact === 'PARTIAL') return true;
  if (w.lostHours > 0) return true;
  // 0.25 in. of rain = 25 hundredths.
  if (typeof w.precipHundredthsInch === 'number' && w.precipHundredthsInch >= 25) {
    return true;
  }
  if (typeof w.windMph === 'number' && w.windMph >= 25) return true;
  if (typeof w.highF === 'number' && w.highF >= 100) return true;
  if (typeof w.lowF === 'number' && w.lowF <= 32) return true;
  return false;
}
