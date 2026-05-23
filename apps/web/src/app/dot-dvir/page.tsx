'use client';

// /dot-dvir — daily vehicle inspection report (§396.11).
//
// Wires bundle 2527's data model into a form. CDL driver picks
// pre- or post-trip, fills in truck + trailer + odometer, runs
// down the 12-point checklist tapping DEFECT for anything wrong.
// A live verdict at the top shows ready-to-drive / off-road
// status based on safety-critical defects.
//
// Pure client side — no persisted store yet. A follow-up bundle
// adds the Prisma table + audit log.

import { useMemo, useState } from 'react';
import {
  DotInspectionPointKindSchema,
  blankChecklist,
  pointLabel,
  verdictFor,
  type DotInspectionPoint,
  type DotInspectionPointKind,
  type DotInspectionPointStatus,
  type DotInspectionReport,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';

const INPUT = 'w-full rounded border border-gray-300 px-3 py-2 text-sm';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const POINT_KINDS: DotInspectionPointKind[] = DotInspectionPointKindSchema.options;

export default function DotDvirPage() {
  const [driverName, setDriverName] = useState('');
  const [powerUnit, setPowerUnit] = useState('Truck-7');
  const [trailerId, setTrailerId] = useState('');
  const [odometer, setOdometer] = useState('');
  const [inspectionDate, setInspectionDate] = useState(todayIso());
  const [kind, setKind] = useState<'PRE_TRIP' | 'POST_TRIP'>('PRE_TRIP');
  const [points, setPoints] = useState<DotInspectionPoint[]>(blankChecklist());

  const verdict = useMemo(() => {
    const fakeReport: DotInspectionReport = {
      id: 'preview',
      driverId: 'preview',
      driverName: driverName || 'Preview',
      powerUnit: powerUnit || 'Preview',
      trailerId: trailerId || undefined,
      odometer: Number(odometer) || undefined,
      inspectionDate,
      kind,
      points,
    };
    return verdictFor(fakeReport);
  }, [driverName, powerUnit, trailerId, odometer, inspectionDate, kind, points]);

  function setPointStatus(k: DotInspectionPointKind, status: DotInspectionPointStatus) {
    setPoints((prev) =>
      prev.map((p) => (p.kind === k ? { ...p, status } : p)),
    );
  }
  function setPointNote(k: DotInspectionPointKind, note: string) {
    setPoints((prev) =>
      prev.map((p) => (p.kind === k ? { ...p, note: note || undefined } : p)),
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Driver vehicle inspection (§396.11)"
          subtitle="Pre-trip or post-trip per FMCSA. Tap DEFECT on anything wrong. Safety-critical defects (brakes / steering / tires / lights / coupling / wheels) take the truck off the road until the mechanic signs off."
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <Tile
            label="Verdict"
            value={verdict.readyToDrive ? 'Ready to drive' : 'OFF ROAD'}
          />
          <Tile label="Defects" value={String(verdict.defectCount)} />
          <Tile label="Safety-critical" value={String(verdict.safetyCriticalDefectCount)} />
          <Tile
            label="Mechanic sign-off"
            value={verdict.requiresMechanicSignoff ? 'Required' : 'Not required'}
          />
        </div>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Header</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Driver">
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Power unit">
              <input value={powerUnit} onChange={(e) => setPowerUnit(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Trailer (optional)">
              <input value={trailerId} onChange={(e) => setTrailerId(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Odometer">
              <input value={odometer} onChange={(e) => setOdometer(e.target.value)} className={`${INPUT} font-mono`} />
            </Field>
            <Field label="Date">
              <input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Pre or post-trip">
              <select value={kind} onChange={(e) => setKind(e.target.value as 'PRE_TRIP' | 'POST_TRIP')} className={INPUT}>
                <option value="PRE_TRIP">Pre-trip</option>
                <option value="POST_TRIP">Post-trip</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">12-point checklist</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2">Point</th>
                <th className="py-2">Status</th>
                <th className="py-2">Note (if defect)</th>
              </tr>
            </thead>
            <tbody>
              {POINT_KINDS.map((k) => {
                const point = points.find((p) => p.kind === k);
                if (!point) return null;
                return (
                  <tr key={k} className="border-t border-gray-200">
                    <td className="py-2 text-gray-900">{pointLabel(k)}</td>
                    <td className="py-2">
                      <select
                        value={point.status}
                        onChange={(e) =>
                          setPointStatus(k, e.target.value as DotInspectionPointStatus)
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option value="OK">OK</option>
                        <option value="DEFECT">DEFECT</option>
                        <option value="NOT_APPLICABLE">N/A</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <input
                        value={point.note ?? ''}
                        onChange={(e) => setPointNote(k, e.target.value)}
                        placeholder={point.status === 'DEFECT' ? 'Describe' : ''}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
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
