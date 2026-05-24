// Quarry-trucking panel — renders for each aggregate / import bid
// item, computes nearest NorCal quarries + cycle time + per-unit
// haul cost so the estimator sees the trucking math instead of
// having to do it in their head.
//
// Server-component friendly: no client hooks. Caller passes the
// already-classified draft + geocoded job site.

import type { PtoEOutput, QuarryHaulOption, QuarryMaterial } from '@yge/shared';
import {
  formatUSD,
  geocodeJobSite,
  inferQuarryMaterial,
  nearestQuarriesWithHaul,
  QUARRY_MATERIAL_LABEL,
} from '@yge/shared';

interface Props {
  draft: PtoEOutput;
}

/** Capacity defaults per material — TON for hot mix, CY for everything
 *  else. Caller can override per row later via the estimate editor. */
function defaultCapacity(material: QuarryMaterial): number {
  // HMA bid in TON, end-dump capacity ~22 TON. Aggregate/CY ~14.
  if (material === 'HMA_TYPE_A' || material === 'HMA_RHMA' || material === 'COLD_MIX') {
    return 22;
  }
  return 14;
}

/** Build the per-item analysis. Returns null entries for items that
 *  aren't quarry-sourced — caller filters them out. */
interface QuarryAnalysisRow {
  itemNumber: string;
  description: string;
  unit: string;
  quantity: number;
  material: QuarryMaterial;
  options: QuarryHaulOption[];
}

function buildAnalysis(
  draft: PtoEOutput,
  jobLat: number,
  jobLng: number,
): QuarryAnalysisRow[] {
  const rows: QuarryAnalysisRow[] = [];
  for (const item of draft.bidItems) {
    const material = inferQuarryMaterial(item.description, item.unit);
    if (!material) continue;
    const capacity = defaultCapacity(material);
    const options = nearestQuarriesWithHaul({
      jobLat,
      jobLng,
      material,
      capacityPerLoad: capacity,
      maxResults: 3,
    });
    if (options.length === 0) continue;
    rows.push({
      itemNumber: item.itemNumber,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      material,
      options,
    });
  }
  return rows;
}

export function QuarryTruckingPanel({ draft }: Props) {
  // Try to locate the job. If we can't, render a helpful prompt to
  // the user instead of silently disappearing.
  const geo = geocodeJobSite({
    lat: draft.locationLat,
    lng: draft.locationLng,
    city: draft.locationCity,
    county: draft.locationCounty,
  });

  if (!geo) {
    return (
      <details className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-gray-700">
          Quarry trucking · location unknown
        </summary>
        <p className="mt-2 text-xs text-gray-600">
          The AI couldn&apos;t pin the job location to a NorCal city. Add{' '}
          <code className="rounded bg-gray-200 px-1">locationCity</code> and{' '}
          <code className="rounded bg-gray-200 px-1">locationCounty</code> on
          the estimate so the trucking-cycle math can run. The default city table
          covers Shasta / Tehama / Trinity / Siskiyou / Butte / Glenn / Lassen
          plus the Sacramento Valley.
        </p>
      </details>
    );
  }

  const analysis = buildAnalysis(draft, geo.lat, geo.lng);
  if (analysis.length === 0) {
    return (
      <details className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-gray-700">
          Quarry trucking · no quarry-sourced items detected
        </summary>
        <p className="mt-2 text-xs text-gray-600">
          No bid items looked like aggregate / asphalt / import / drain rock /
          ready-mix. Either the bid genuinely has no quarry material, or item
          descriptions need a phrase like &quot;Class 2 AB&quot;, &quot;HMA Type A&quot;,
          &quot;imported borrow&quot;, etc.
        </p>
      </details>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Quarry trucking
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Site located via{' '}
          {geo.source === 'explicit-coordinates'
            ? 'explicit coordinates in the plans'
            : geo.source === 'city-match'
              ? `${geo.matchedCity?.name} centroid`
              : `${geo.matchedCity?.county} county centroid`}{' '}
          at {geo.lat.toFixed(3)}, {geo.lng.toFixed(3)}. Haul cost assumes
          14-CY / 22-TON end-dump at $165 / hr; cycle includes 15 min load + 5
          min dump + 10 min queue.
        </p>
      </header>
      <ul className="divide-y divide-gray-100">
        {analysis.map((row) => {
          const best = row.options[0]!;
          const totalHaulCents = best.cost.totalCostForQuantityCents(row.quantity);
          return (
            <li key={`${row.itemNumber}-${row.material}`} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    <span className="text-gray-500">#{row.itemNumber}</span>{' '}
                    {row.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    {QUARRY_MATERIAL_LABEL[row.material]} · {row.quantity.toLocaleString()} {row.unit}
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums">
                  <div className="font-semibold text-gray-900">
                    Haul ≈ {formatUSD(totalHaulCents, { compact: true })}
                  </div>
                  <div className="text-gray-500">
                    {best.cost.loadsForQuantity(row.quantity).toLocaleString()} loads ·{' '}
                    {formatUSD(best.cost.costPerUnitCents)} / {row.unit}
                  </div>
                </div>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 pr-3 text-left font-medium">Source</th>
                      <th className="py-1 pr-3 text-right font-medium">Road mi</th>
                      <th className="py-1 pr-3 text-right font-medium">Cycle min</th>
                      <th className="py-1 pr-3 text-right font-medium">$ / load</th>
                      <th className="py-1 pr-3 text-right font-medium">$ / {row.unit}</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {row.options.map((opt, idx) => (
                      <tr
                        key={opt.quarry.id}
                        className={idx === 0 ? 'bg-yge-blue-50 font-medium' : ''}
                      >
                        <td className="py-1 pr-3">{opt.quarry.name}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">
                          {opt.roadMiles}
                        </td>
                        <td className="py-1 pr-3 text-right tabular-nums">
                          {Math.round(opt.cycle.cycleMinutes)}
                        </td>
                        <td className="py-1 pr-3 text-right tabular-nums">
                          {formatUSD(opt.cost.costPerLoadCents)}
                        </td>
                        <td className="py-1 pr-3 text-right tabular-nums">
                          {formatUSD(opt.cost.costPerUnitCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
