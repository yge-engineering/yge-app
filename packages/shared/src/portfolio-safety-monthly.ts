// Portfolio safety scoreboard by month.
//
// Plain English: per yyyy-mm, surface the safety vital signs in
// one row — incidents (with classification mix), days away,
// days restricted, toolbox-talk count, total signed-attendee
// count, weather lost-hours. Drives the monthly safety review
// the IIPP coordinator presents.
//
// Per row: month, incidents, byClassification, daysAway,
// daysRestricted, toolboxTalks, signedAttendees, weatherLostHours.
//
// Sort: month asc.
//
// Different from incident-monthly-trend (incidents only),
// dart-rate-monthly (rate calc), toolbox-compliance (overall
// rate), heat-illness-audit (specific T8 §3395 audit).
//
// Pure derivation. No persisted records.

import type { Incident, IncidentClassification } from './incident';
import type { ToolboxTalk } from './toolbox-talk';
import type { WeatherLog } from './weather-log';

export interface PortfolioSafetyMonthlyRow {
  month: string;
  incidents: number;
  byClassification: Partial<Record<IncidentClassification, number>>;
  daysAway: number;
  daysRestricted: number;
  toolboxTalks: number;
  signedAttendees: number;
  weatherLostHours: number;
}

export interface PortfolioSafetyMonthlyRollup {
  monthsConsidered: number;
  totalIncidents: number;
  totalDaysAway: number;
  totalToolboxTalks: number;
  totalWeatherLostHours: number;
}

export interface PortfolioSafetyMonthlyInputs {
  incidents: Incident[];
  toolboxTalks: ToolboxTalk[];
  weatherLogs: WeatherLog[];
  /** Optional yyyy-mm bounds inclusive applied to all dates. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioSafetyMonthly(
  inputs: PortfolioSafetyMonthlyInputs,
): {
  rollup: PortfolioSafetyMonthlyRollup;
  rows: PortfolioSafetyMonthlyRow[];
} {
  type Acc = {
    month: string;
    incidents: number;
    byClassification: Map<IncidentClassification, number>;
    daysAway: number;
    daysRestricted: number;
    toolboxTalks: number;
    signedAttendees: number;
    weatherLostHours: number;
  };
  const accs = new Map<string, Acc>();

  let totalIncidents = 0;
  let totalDaysAway = 0;
  let totalToolboxTalks = 0;
  let totalWeatherLostHours = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  function get(month: string): Acc {
    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        incidents: 0,
        byClassification: new Map(),
        daysAway: 0,
        daysRestricted: 0,
        toolboxTalks: 0,
        signedAttendees: 0,
        weatherLostHours: 0,
      };
      accs.set(month, a);
    }
    return a;
  }

  for (const inc of inputs.incidents) {
    const month = inc.incidentDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const a = get(month);
    a.incidents += 1;
    a.byClassification.set(
      inc.classification,
      (a.byClassification.get(inc.classification) ?? 0) + 1,
    );
    a.daysAway += inc.daysAway ?? 0;
    a.daysRestricted += inc.daysRestricted ?? 0;
    totalIncidents += 1;
    totalDaysAway += inc.daysAway ?? 0;
  }

  for (const t of inputs.toolboxTalks) {
    const month = t.heldOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const a = get(month);
    a.toolboxTalks += 1;
    for (const at of t.attendees ?? []) {
      if (at.signed) a.signedAttendees += 1;
    }
    totalToolboxTalks += 1;
  }

  for (const w of inputs.weatherLogs) {
    const month = w.observedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const a = get(month);
    a.weatherLostHours += w.lostHours ?? 0;
    totalWeatherLostHours += w.lostHours ?? 0;
  }

  const rows: PortfolioSafetyMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byClassification: Partial<Record<IncidentClassification, number>> = {};
      for (const [k, v] of a.byClassification) byClassification[k] = v;
      return {
        month: a.month,
        incidents: a.incidents,
        byClassification,
        daysAway: a.daysAway,
        daysRestricted: a.daysRestricted,
        toolboxTalks: a.toolboxTalks,
        signedAttendees: a.signedAttendees,
        weatherLostHours: a.weatherLostHours,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalIncidents,
      totalDaysAway,
      totalToolboxTalks,
      totalWeatherLostHours,
    },
    rows,
  };
}
