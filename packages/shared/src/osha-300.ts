// Cal/OSHA Form 300 + 300A — log of work-related injuries and illnesses.

import type {
  Incident,
  IncidentClassification,
  IncidentOutcome,
} from './incident';

export interface Osha300Row {
  caseNumber: string;
  employeeName: string;
  jobTitle: string;
  incidentDate: string;
  location: string;
  description: string;
  classification: IncidentClassification;
  outcome: IncidentOutcome;
  daysAway: number;
  daysRestricted: number;
  died: boolean;
  illnessColumn:
    | 'INJURY'
    | 'SKIN_DISORDER'
    | 'RESPIRATORY'
    | 'POISONING'
    | 'HEARING_LOSS'
    | 'OTHER_ILLNESS';
}

export interface Osha300ASummary {
  logYear: number;
  totalCases: number;
  byOutcome: Record<IncidentOutcome, number>;
  byClassification: Record<IncidentClassification, number>;
  totalDaysAway: number;
  totalDaysRestricted: number;
}

export function illnessColumnFor(c: IncidentClassification): Osha300Row['illnessColumn'] {
  switch (c) {
    case 'INJURY':
      return 'INJURY';
    case 'SKIN_DISORDER':
      return 'SKIN_DISORDER';
    case 'RESPIRATORY':
      return 'RESPIRATORY';
    case 'POISONING':
      return 'POISONING';
    case 'HEARING_LOSS':
      return 'HEARING_LOSS';
    case 'OTHER_ILLNESS':
      return 'OTHER_ILLNESS';
  }
}

export function incidentsForLogYear(incidents: Incident[], year: number): Incident[] {
  return incidents.filter((i) => {
    const y = parseInt(i.incidentDate.slice(0, 4), 10);
    return y === year;
  });
}

export function buildOsha300Rows(incidents: Incident[], year: number): Osha300Row[] {
  return incidentsForLogYear(incidents, year)
    .slice()
    .sort((a, b) => a.caseNumber.localeCompare(b.caseNumber, undefined, { numeric: true }))
    .map((i) => ({
      caseNumber: i.caseNumber,
      // §1904.29(b)(7) privacy-case rule.
      employeeName: i.privacyCase ? 'Privacy Case' : i.employeeName,
      jobTitle: i.jobTitle ?? '',
      incidentDate: i.incidentDate,
      location: i.location,
      description: i.description,
      classification: i.classification,
      outcome: i.outcome,
      daysAway: i.daysAway,
      daysRestricted: i.daysRestricted,
      died: i.died,
      illnessColumn: illnessColumnFor(i.classification),
    }));
}

const EMPTY_BY_OUTCOME: Record<IncidentOutcome, number> = {
  DEATH: 0,
  DAYS_AWAY: 0,
  JOB_TRANSFER_OR_RESTRICTION: 0,
  OTHER_RECORDABLE: 0,
};
const EMPTY_BY_CLASSIFICATION: Record<IncidentClassification, number> = {
  INJURY: 0,
  SKIN_DISORDER: 0,
  RESPIRATORY: 0,
  POISONING: 0,
  HEARING_LOSS: 0,
  OTHER_ILLNESS: 0,
};

export function buildOsha300ASummary(
  incidents: Incident[],
  year: number,
): Osha300ASummary {
  const cases = incidentsForLogYear(incidents, year);
  const byOutcome: Record<IncidentOutcome, number> = { ...EMPTY_BY_OUTCOME };
  const byClassification: Record<IncidentClassification, number> = {
    ...EMPTY_BY_CLASSIFICATION,
  };
  let totalDaysAway = 0;
  let totalDaysRestricted = 0;
  for (const c of cases) {
    byOutcome[c.outcome] += 1;
    byClassification[c.classification] += 1;
    totalDaysAway += c.daysAway;
    totalDaysRestricted += c.daysRestricted;
  }
  return {
    logYear: year,
    totalCases: cases.length,
    byOutcome,
    byClassification,
    totalDaysAway,
    totalDaysRestricted,
  };
}

export function osha300CsvRows(rows: Osha300Row[]): {
  headers: string[];
  rows: Array<Array<string | number>>;
} {
  return {
    headers: [
      'Case #',
      'Employee',
      'Job title',
      'Date',
      'Where',
      'Description',
      'Classification',
      'Outcome',
      'Days away',
      'Days restricted',
      'Died',
      'Illness column',
    ],
    rows: rows.map((r) => [
      r.caseNumber,
      r.employeeName,
      r.jobTitle,
      r.incidentDate,
      r.location,
      r.description,
      r.classification,
      r.outcome,
      r.daysAway,
      r.daysRestricted,
      r.died ? 'Y' : 'N',
      r.illnessColumn,
    ]),
  };
}
