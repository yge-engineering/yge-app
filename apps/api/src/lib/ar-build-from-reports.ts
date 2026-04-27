// Build AR invoice line items from daily reports.
//
// Walks every submitted daily report for a job within [start, end],
// rolls hours by classification, multiplies by the per-classification
// rate the caller provided, and returns suggested line items.
//
// Equipment hours come from the daily report's crewOnSite (operator
// time) but a richer model would pull from per-equipment-on-job hours
// once that's tracked. Phase 1 outputs labor only — equipment can be
// added manually until per-job equipment-hour tracking lands.

import {
  classificationLabel,
  crewRowWorkedMinutes,
  type ArInvoiceBuildFromReports,
  type ArInvoiceLineItem,
  type DailyReport,
  type DirClassification,
  type Employee,
} from '@yge/shared';

export interface BuildArLineItemsResult {
  lineItems: ArInvoiceLineItem[];
  /** Reports that contributed. */
  reportsConsulted: number;
  /** Hours rolled up per classification — useful for the print page. */
  hoursPerClassification: Array<{
    classification: DirClassification;
    hours: number;
    rateCentsPerHour: number;
    lineTotalCents: number;
  }>;
  /** Reports filtered out because they're not yet submitted. */
  unsubmittedReportsSkipped: number;
}

/** Aggregate submitted daily reports into AR invoice line items. */
export function buildArLineItemsFromReports(
  reports: DailyReport[],
  employees: Employee[],
  jobId: string,
  options: ArInvoiceBuildFromReports,
): BuildArLineItemsResult {
  const empById = new Map(employees.map((e) => [e.id, e]));
  const hoursByClass = new Map<DirClassification, { minutes: number; refs: Set<string> }>();
  let consulted = 0;
  let unsubmittedSkipped = 0;

  for (const r of reports) {
    if (r.jobId !== jobId) continue;
    if (r.date < options.start || r.date > options.end) continue;
    if (!r.submitted) {
      unsubmittedSkipped += 1;
      continue;
    }
    consulted += 1;
    for (const row of r.crewOnSite) {
      const emp = empById.get(row.employeeId);
      const cls: DirClassification = emp?.classification ?? 'NOT_APPLICABLE';
      const minutes = crewRowWorkedMinutes(row);
      if (minutes <= 0) continue;
      const cur = hoursByClass.get(cls) ?? { minutes: 0, refs: new Set<string>() };
      cur.minutes += minutes;
      cur.refs.add(r.id);
      hoursByClass.set(cls, cur);
    }
  }

  const defaultRate = options.defaultLaborRateCentsPerHour ?? 0;
  const periodLabel = `${options.start} to ${options.end}`;
  const lineItems: ArInvoiceLineItem[] = [];
  const perClass: BuildArLineItemsResult['hoursPerClassification'] = [];

  if (options.consolidateLabor) {
    // One LABOR line totalling all hours across all classifications.
    let totalMinutes = 0;
    const refs = new Set<string>();
    for (const v of hoursByClass.values()) {
      totalMinutes += v.minutes;
      v.refs.forEach((x) => refs.add(x));
    }
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
    if (totalHours > 0) {
      const lineTotalCents = Math.round(totalHours * defaultRate);
      lineItems.push({
        kind: 'LABOR',
        description: `Labor — ${periodLabel}`,
        unit: 'HR',
        quantity: totalHours,
        unitPriceCents: defaultRate,
        lineTotalCents,
        sourceRefs: Array.from(refs),
        note: `${consulted} daily report${consulted === 1 ? '' : 's'} consolidated`,
      });
      perClass.push({
        classification: 'NOT_APPLICABLE',
        hours: totalHours,
        rateCentsPerHour: defaultRate,
        lineTotalCents,
      });
    }
    return {
      lineItems,
      reportsConsulted: consulted,
      hoursPerClassification: perClass,
      unsubmittedReportsSkipped: unsubmittedSkipped,
    };
  }

  // Per-classification lines.
  for (const [cls, v] of hoursByClass.entries()) {
    const hours = Math.round((v.minutes / 60) * 100) / 100;
    if (hours <= 0) continue;
    const rate =
      options.laborRatesCentsPerHour?.[cls] !== undefined
        ? options.laborRatesCentsPerHour[cls]!
        : defaultRate;
    const lineTotalCents = Math.round(hours * rate);
    lineItems.push({
      kind: 'LABOR',
      description: `${classificationLabel(cls)} — ${periodLabel}`,
      unit: 'HR',
      quantity: hours,
      unitPriceCents: rate,
      lineTotalCents,
      sourceRefs: Array.from(v.refs),
    });
    perClass.push({
      classification: cls,
      hours,
      rateCentsPerHour: rate,
      lineTotalCents,
    });
  }

  // Stable order: classification name asc.
  lineItems.sort((a, b) => a.description.localeCompare(b.description));
  perClass.sort((a, b) => a.classification.localeCompare(b.classification));

  return {
    lineItems,
    reportsConsulted: consulted,
    hoursPerClassification: perClass,
    unsubmittedReportsSkipped: unsubmittedSkipped,
  };
}
