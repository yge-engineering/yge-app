import { describe, expect, it } from 'vitest';
import { buildPhotoEvidenceIndex } from './photo-evidence';
import type { DailyReport } from './daily-report';
import type { Incident } from './incident';
import type { Photo } from './photo';
import type { WeatherLog } from './weather-log';

function photo(over: Partial<Photo>): Photo {
  return {
    id: 'ph-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    takenOn: '2026-04-15',
    location: 'Sta. 12+50',
    caption: 'Backslope drainage',
    category: 'PROGRESS',
    reference: 'IMG_001.jpg',
    ...over,
  } as Photo;
}

function wx(over: Partial<WeatherLog>): WeatherLog {
  return {
    id: 'wx-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    observedOn: '2026-04-15',
    primaryCondition: 'CLEAR',
    impact: 'NONE',
    lostHours: 0,
    heatProceduresActivated: false,
    highHeatProceduresActivated: false,
    ...over,
  } as WeatherLog;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'job-1',
    foremanId: 'emp-bob',
    weather: 'sunny',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '',
    updatedAt: '',
    caseNumber: '2026-001',
    logYear: 2026,
    jobId: 'job-1',
    incidentDate: '2026-04-15',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    daysAway: 0,
    daysRestricted: 0,
    privacyCase: false,
    died: false,
    treatedInER: false,
    hospitalizedOvernight: false,
    calOshaReported: false,
    status: 'OPEN',
    ...over,
  } as Incident;
}

describe('buildPhotoEvidenceIndex', () => {
  it('filters by job + date range + category', () => {
    const r = buildPhotoEvidenceIndex({
      start: '2026-04-13',
      end: '2026-04-17',
      jobId: 'job-A',
      category: 'PROGRESS',
      photos: [
        photo({ id: 'p1', jobId: 'job-A', takenOn: '2026-04-15', category: 'PROGRESS' }),
        photo({ id: 'p2', jobId: 'job-B', takenOn: '2026-04-15', category: 'PROGRESS' }),
        photo({ id: 'p3', jobId: 'job-A', takenOn: '2026-04-30', category: 'PROGRESS' }),
        photo({ id: 'p4', jobId: 'job-A', takenOn: '2026-04-15', category: 'INCIDENT' }),
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual(['p1']);
  });

  it('requireGps filter drops photos without lat/lng', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [
        photo({ id: 'with-gps', latitude: 40.5, longitude: -122.3 }),
        photo({ id: 'no-gps' }),
      ],
      requireGps: true,
    });
    expect(r.rows.map((x) => x.id)).toEqual(['with-gps']);
  });

  it('cross-references weather + daily report + incident on same job/date', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [photo({ id: 'p', jobId: 'job-1', takenOn: '2026-04-15' })],
      weatherLog: [wx({ jobId: 'job-1', observedOn: '2026-04-15' })],
      dailyReports: [dr({ id: 'dr-x', jobId: 'job-1', date: '2026-04-15' })],
      incidents: [inc({ id: 'inc-x', jobId: 'job-1', incidentDate: '2026-04-15' })],
    });
    const row = r.rows[0]!;
    expect(row.weatherSameDay).toBe(true);
    expect(row.dailyReportSameDay).toBe(true);
    expect(row.incidentSameDay).toBe(true);
  });

  it('weatherDelayCandidate flips when impact=STOPPED', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [photo({ id: 'p' })],
      weatherLog: [wx({ impact: 'STOPPED' })],
    });
    expect(r.rows[0]?.weatherDelayCandidate).toBe(true);
  });

  it('weatherDelayCandidate flips on heavy precip (>=0.25 in)', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [photo({ id: 'p' })],
      weatherLog: [wx({ impact: 'NONE', precipHundredthsInch: 30 })],
    });
    expect(r.rows[0]?.weatherDelayCandidate).toBe(true);
  });

  it('weatherDelayCandidate stays false on light rain', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [photo({ id: 'p' })],
      weatherLog: [wx({ impact: 'NONE', precipHundredthsInch: 5 })],
    });
    expect(r.rows[0]?.weatherDelayCandidate).toBe(false);
  });

  it('skips DRAFT daily reports for cross-reference', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [photo({ id: 'p' })],
      dailyReports: [dr({ submitted: false })],
    });
    expect(r.rows[0]?.dailyReportSameDay).toBe(false);
  });

  it('evidenceLinkCount counts links from photo + cross-refs', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [
        photo({
          id: 'p',
          rfiId: 'rfi-1',
          changeOrderId: 'co-1',
          incidentId: 'inc-1',
        }),
      ],
      weatherLog: [wx({})],
      // No daily-report cross-ref. incidentId is already linked
      // directly on the photo, so the SAME-day cross-ref shouldn't
      // double-count.
      incidents: [inc({ id: 'inc-1' })],
    });
    // Direct: rfi (1), co (1), incident (1) = 3
    // Cross-ref: weather sameDay (1)
    // incident cross-ref skipped because incidentId already linked
    expect(r.rows[0]?.evidenceLinkCount).toBe(4);
  });

  it('counts.byCategory tallies each category', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [
        photo({ id: '1', category: 'PROGRESS' }),
        photo({ id: '2', category: 'PROGRESS' }),
        photo({ id: '3', category: 'INCIDENT' }),
      ],
    });
    expect(r.counts.byCategory.PROGRESS).toBe(2);
    expect(r.counts.byCategory.INCIDENT).toBe(1);
    expect(r.counts.byCategory.SWPPP).toBe(0);
  });

  it('sorts evidence-rich first, newest first within tie', () => {
    const r = buildPhotoEvidenceIndex({
      photos: [
        photo({ id: 'old-rich', takenOn: '2026-04-01', incidentId: 'inc-1' }),
        photo({ id: 'new-bare', takenOn: '2026-04-25' }),
        photo({ id: 'newer-bare', takenOn: '2026-04-26' }),
      ],
    });
    expect(r.rows.map((x) => x.id)).toEqual([
      'old-rich',     // 1 link
      'newer-bare',   // 0 links, newer
      'new-bare',     // 0 links, older
    ]);
  });
});
