'use client';

// /equipment-fuel-burn — gph audit per piece of equipment.
//
// Wires bundle 2537. Paste hour-meter reads + fuel deliveries
// CSVs, pick equipmentId, see per-interval gallons-per-hour with
// severity flags.

import { useMemo, useState } from 'react';

import {
  buildFuelBurnReport,
  type FuelDelivery,
  type HourMeterRead,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

const SEED_READS = `# date,hourMeter
2026-05-01, 1000
2026-05-08, 1050
2026-05-15, 1110
2026-05-22, 1170`;

const SEED_DELIVERIES = `# date, gallons, $/gal (optional)
2026-05-03, 200, 4.50
2026-05-10, 300, 4.50
2026-05-17, 580, 4.55`;

function parseReads(text: string, equipmentId: string): HourMeterRead[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('#'))
    .flatMap((line) => {
      const [date, hm] = line.split(',').map((c) => c.trim());
      const hours = Number(hm);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isFinite(hours)) return [];
      return [{ equipmentId, date: date!, hourMeter: hours }];
    });
}

function parseDeliveries(text: string, equipmentId: string): FuelDelivery[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith('#'))
    .flatMap((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const [date, gallonsStr, priceStr] = cols;
      const gallons = Number(gallonsStr);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isFinite(gallons)) return [];
      const cents = priceStr ? Math.round(Number(priceStr) * 100) : undefined;
      return [{
        equipmentId,
        date: date!,
        gallons,
        unitPriceCentsPerGallon: Number.isFinite(cents) ? cents : undefined,
      }];
    });
}

const TONE: Record<'normal' | 'high' | 'critical', string> = {
  normal: 'bg-green-50 text-green-900',
  high: 'bg-amber-50 text-amber-900',
  critical: 'bg-red-50 text-red-900',
};

export default function EquipmentFuelBurnPage() {
  const [equipmentId, setEquipmentId] = useState('eq-1');
  const [readsCsv, setReadsCsv] = useState(SEED_READS);
  const [deliveriesCsv, setDeliveriesCsv] = useState(SEED_DELIVERIES);
  const [highThr, setHighThr] = useState('8');
  const [critThr, setCritThr] = useState('12');

  const reads = useMemo(() => parseReads(readsCsv, equipmentId), [readsCsv, equipmentId]);
  const deliveries = useMemo(
    () => parseDeliveries(deliveriesCsv, equipmentId),
    [deliveriesCsv, equipmentId],
  );

  const report = useMemo(
    () =>
      buildFuelBurnReport({
        equipmentId,
        reads,
        deliveries,
        highGphThreshold: Number(highThr) || 8,
        criticalGphThreshold: Number(critThr) || 12,
      }),
    [equipmentId, reads, deliveries, highThr, critThr],
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-8">
        <PageHeader
          title="Equipment fuel burn"
          subtitle="Hour-meter reads + fuel deliveries → gallons per hour per interval. A jump usually means idle left on, a leak, or a stolen fuel card."
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <Tile label="Equipment" value={equipmentId} />
          <Tile label="Avg gph" value={String(report.averageGph)} />
          <Tile label="High intervals" value={String(report.highSeverityCount)} />
          <Tile label="Critical intervals" value={String(report.criticalSeverityCount)} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Inputs</h2>

            <Field label="Equipment id">
              <input value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} className={INPUT} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="High threshold (gph)">
                <input value={highThr} onChange={(e) => setHighThr(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
              <Field label="Critical threshold (gph)">
                <input value={critThr} onChange={(e) => setCritThr(e.target.value)} className={`${INPUT} font-mono`} />
              </Field>
            </div>

            <h3 className="mt-4 text-sm font-semibold text-gray-700">Hour-meter reads (CSV)</h3>
            <p className="text-xs text-gray-500">date,hourMeter</p>
            <textarea
              value={readsCsv}
              onChange={(e) => setReadsCsv(e.target.value)}
              rows={8}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
            />

            <h3 className="mt-4 text-sm font-semibold text-gray-700">Fuel deliveries (CSV)</h3>
            <p className="text-xs text-gray-500">date,gallons,$/gal (price optional)</p>
            <textarea
              value={deliveriesCsv}
              onChange={(e) => setDeliveriesCsv(e.target.value)}
              rows={8}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs"
            />
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Burn intervals</h2>
            {report.intervals.length === 0 ? (
              <p className="text-sm text-gray-600">
                Need at least 2 hour-meter reads + 1 fuel delivery between them.
              </p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2">Window</th>
                    <th className="py-2 text-right">Hours</th>
                    <th className="py-2 text-right">Gallons</th>
                    <th className="py-2 text-right">gph</th>
                    <th className="py-2 text-right">Cost</th>
                    <th className="py-2">Sev</th>
                  </tr>
                </thead>
                <tbody>
                  {report.intervals.map((iv, i) => (
                    <tr key={i} className={`border-t border-gray-200 ${TONE[iv.severity]}`}>
                      <td className="py-2 font-mono text-xs">{iv.startDate} → {iv.endDate}</td>
                      <td className="py-2 text-right font-mono">{iv.hoursWorked}</td>
                      <td className="py-2 text-right font-mono">{iv.gallonsBurned}</td>
                      <td className="py-2 text-right font-mono font-semibold">{iv.gph}</td>
                      <td className="py-2 text-right font-mono">
                        ${(iv.costCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 text-xs font-semibold uppercase">{iv.severity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
