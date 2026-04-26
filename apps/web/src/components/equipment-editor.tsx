'use client';

// Equipment editor — full detail page client island.
//
// Three big sections:
//   1. Identification (PATCH on blur for name/make/model/etc.)
//   2. Status / dispatch (assign-to-job + return + status changes)
//   3. Maintenance log (append-only; pushing a new entry rolls
//      lastServiceUsage forward server-side)

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  equipmentCategoryLabel,
  equipmentStatusLabel,
  formatUSD,
  formatUsage,
  fullName,
  maintenanceKindLabel,
  nextServiceDueUsage,
  serviceDueLevel,
  type Employee,
  type Equipment,
  type EquipmentCategory,
  type EquipmentStatus,
  type EquipmentUsageMetric,
  type Job,
  type MaintenanceKind,
  type MaintenanceLogEntry,
} from '@yge/shared';

const CATEGORIES: EquipmentCategory[] = [
  'TRUCK',
  'TRAILER',
  'DOZER',
  'EXCAVATOR',
  'LOADER',
  'BACKHOE',
  'GRADER',
  'ROLLER',
  'PAVER',
  'COMPACTOR_LARGE',
  'WATER_TRUCK',
  'SWEEPER',
  'GENERATOR_LARGE',
  'SUPPORT',
  'OTHER',
];

const STATUS_OPTIONS: EquipmentStatus[] = [
  'IN_YARD',
  'IN_SERVICE',
  'OUT_FOR_REPAIR',
  'RETIRED',
  'SOLD',
];

const MAINTENANCE_KINDS: MaintenanceKind[] = [
  'OIL_CHANGE',
  'FILTER',
  'TIRE',
  'BRAKE',
  'HYDRAULIC',
  'ELECTRICAL',
  'COOLING',
  'TRANSMISSION',
  'ENGINE_MAJOR',
  'INSPECTION',
  'BREAKDOWN_REPAIR',
  'OTHER',
];

interface Props {
  initial: Equipment;
  employees: Employee[];
  jobs: Job[];
  apiBaseUrl: string;
}

export function EquipmentEditor({ initial, employees, jobs, apiBaseUrl }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [eq, setEq] = useState<Equipment>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form mirrors for free-text fields.
  const [name, setName] = useState(eq.name);
  const [make, setMake] = useState(eq.make ?? '');
  const [model, setModel] = useState(eq.model ?? '');
  const [yearStr, setYearStr] = useState(eq.year?.toString() ?? '');
  const [vin, setVin] = useState(eq.vin ?? '');
  const [serialNumber, setSerialNumber] = useState(eq.serialNumber ?? '');
  const [plateNumber, setPlateNumber] = useState(eq.plateNumber ?? '');
  const [assetTag, setAssetTag] = useState(eq.assetTag ?? '');
  const [currentUsage, setCurrentUsage] = useState(String(eq.currentUsage));
  const [intervalStr, setIntervalStr] = useState(
    eq.serviceIntervalUsage?.toString() ?? '',
  );
  const [lastServiceStr, setLastServiceStr] = useState(
    eq.lastServiceUsage?.toString() ?? '',
  );
  const [notes, setNotes] = useState(eq.notes ?? '');

  // Maintenance log entry form.
  const [logKind, setLogKind] = useState<MaintenanceKind>('OIL_CHANGE');
  const [logDescription, setLogDescription] = useState('');
  const [logUsageStr, setLogUsageStr] = useState('');
  const [logCostStr, setLogCostStr] = useState('');
  const [logVendor, setLogVendor] = useState('');

  // Assign form.
  const [assignJobId, setAssignJobId] = useState<string>(jobs[0]?.id ?? '');
  const [assignOpId, setAssignOpId] = useState<string>('');

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/equipment/${eq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = (await res.json()) as { equipment: Equipment };
      setEq(json.equipment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function saveBasics() {
    void patch({
      name: name.trim() || eq.name,
      make: make.trim() || undefined,
      model: model.trim() || undefined,
      year: yearStr.trim() ? Number(yearStr) : undefined,
      vin: vin.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      plateNumber: plateNumber.trim() || undefined,
      assetTag: assetTag.trim() || undefined,
      currentUsage: currentUsage.trim() ? Number(currentUsage) : eq.currentUsage,
      serviceIntervalUsage: intervalStr.trim() ? Number(intervalStr) : undefined,
      lastServiceUsage: lastServiceStr.trim() ? Number(lastServiceStr) : undefined,
      notes: notes.trim() || undefined,
    });
  }

  async function assign() {
    if (!assignJobId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/equipment/${eq.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: assignJobId,
          assignedOperatorEmployeeId: assignOpId || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Assign failed: ${res.status}`);
      const json = (await res.json()) as { equipment: Equipment };
      setEq(json.equipment);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setSaving(false);
    }
  }

  async function returnUnit(
    destination: 'IN_YARD' | 'IN_SERVICE' | 'OUT_FOR_REPAIR',
  ) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/equipment/${eq.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination }),
      });
      if (!res.ok) throw new Error(`Return failed: ${res.status}`);
      const json = (await res.json()) as { equipment: Equipment };
      setEq(json.equipment);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Return failed');
    } finally {
      setSaving(false);
    }
  }

  async function logService() {
    if (logDescription.trim().length === 0) {
      setError('Description is required for a maintenance log entry.');
      return;
    }
    const usageNum = Number(logUsageStr || eq.currentUsage);
    if (!Number.isFinite(usageNum) || usageNum < 0) {
      setError('Usage at service must be a non-negative number.');
      return;
    }
    const entry: MaintenanceLogEntry = {
      performedAt: new Date().toISOString(),
      usageAtService: Math.round(usageNum),
      kind: logKind,
      description: logDescription.trim(),
      ...(logCostStr.trim() ? { costCents: Math.round(Number(logCostStr) * 100) } : {}),
      ...(logVendor.trim() ? { performedBy: logVendor.trim() } : {}),
    };
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/equipment/${eq.id}/log-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error(`Log failed: ${res.status}`);
      const json = (await res.json()) as { equipment: Equipment };
      setEq(json.equipment);
      // Reset form.
      setLogDescription('');
      setLogUsageStr('');
      setLogCostStr('');
      setLogVendor('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Log failed');
    } finally {
      setSaving(false);
    }
  }

  const next = nextServiceDueUsage(eq);
  const lvl = serviceDueLevel(eq);
  const assignedJob = eq.assignedJobId ? jobs.find((j) => j.id === eq.assignedJobId) : undefined;
  const assignedOp = eq.assignedOperatorEmployeeId
    ? employees.find((x) => x.id === eq.assignedOperatorEmployeeId)
    : undefined;
  const operatorOptions = employees.filter((x) => x.status === 'ACTIVE');

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-yge-blue-500">{eq.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {equipmentCategoryLabel(eq.category)} &middot; {equipmentStatusLabel(eq.status)}
            {' '}&middot; {formatUsage(eq)}
            {next !== undefined && (
              <>
                {' '}&middot; Next service at {next.toLocaleString('en-US')}{' '}
                {eq.usageMetric === 'MILES' ? 'mi' : 'hr'}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={eq.status}
            onChange={(e) => void patch({ status: e.target.value as EquipmentStatus })}
            disabled={eq.status === 'ASSIGNED'}
            className="rounded border border-gray-300 px-2 py-1 disabled:bg-gray-100"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {equipmentStatusLabel(s)}
              </option>
            ))}
          </select>
          {saving && <span className="text-gray-500">Saving&hellip;</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lvl === 'overdue' && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>Service overdue.</strong> This unit is past its next-service
          reading. Schedule shop time before re-dispatch.
        </div>
      )}
      {lvl === 'warn' && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          <strong>Service coming up.</strong> Within 10% of the interval &mdash;
          plan the next stop now.
        </div>
      )}

      {/* Dispatch */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Dispatch</h2>
        {eq.status === 'ASSIGNED' ? (
          <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">
            Currently on{' '}
            <strong>{assignedJob?.projectName ?? eq.assignedJobId}</strong>
            {assignedOp && (
              <>
                {' '}with operator <strong>{fullName(assignedOp)}</strong>
              </>
            )}
            {eq.assignedAt && (
              <span className="text-gray-600"> &middot; since {new Date(eq.assignedAt).toLocaleDateString()}</span>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void returnUnit('IN_YARD')}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
              >
                Return to yard
              </button>
              <button
                type="button"
                onClick={() => void returnUnit('IN_SERVICE')}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
              >
                Send to shop
              </button>
              <button
                type="button"
                onClick={() => void returnUnit('OUT_FOR_REPAIR')}
                className="rounded border border-orange-300 bg-white px-2 py-1 text-xs text-orange-700 hover:bg-orange-50"
              >
                Out for repair
              </button>
            </div>
          </div>
        ) : eq.status === 'RETIRED' || eq.status === 'SOLD' ? (
          <p className="text-sm text-gray-500">
            Unit is {equipmentStatusLabel(eq.status).toLowerCase()} &mdash; not dispatchable.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Job">
              <select
                value={assignJobId}
                onChange={(e) => setAssignJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {jobs.length === 0 && <option value="">No jobs</option>}
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.projectName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Operator (optional)">
              <select
                value={assignOpId}
                onChange={(e) => setAssignOpId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">— None —</option>
                {operatorOptions.map((x) => (
                  <option key={x.id} value={x.id}>
                    {fullName(x)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="self-end">
              <button
                type="button"
                onClick={assign}
                disabled={!assignJobId}
                className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
              >
                Assign to job
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Identification */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category">
          <select
            value={eq.category}
            onChange={(e) =>
              void patch({ category: e.target.value as EquipmentCategory })
            }
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {equipmentCategoryLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Usage metric">
          <select
            value={eq.usageMetric}
            onChange={(e) =>
              void patch({ usageMetric: e.target.value as EquipmentUsageMetric })
            }
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="MILES">Miles (odometer)</option>
            <option value="HOURS">Hours (engine)</option>
          </select>
        </Field>
        <Field label="Year">
          <input
            value={yearStr}
            onChange={(e) => setYearStr(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Make">
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Model">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="VIN">
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Serial / PIN">
          <input
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Plate number">
          <input
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Asset tag">
          <input
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Usage + service */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Field label={`Current ${eq.usageMetric === 'MILES' ? 'odometer' : 'hours'}`}>
          <input
            type="number"
            min="0"
            value={currentUsage}
            onChange={(e) => setCurrentUsage(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={`Last service at ${eq.usageMetric === 'MILES' ? 'mi' : 'hr'}`}>
          <input
            type="number"
            min="0"
            value={lastServiceStr}
            onChange={(e) => setLastServiceStr(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={`Service interval (${eq.usageMetric === 'MILES' ? 'mi' : 'hr'})`}>
          <input
            type="number"
            min="1"
            value={intervalStr}
            onChange={(e) => setIntervalStr(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>

      {/* Maintenance log */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Maintenance log</h2>

        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kind">
              <select
                value={logKind}
                onChange={(e) => setLogKind(e.target.value as MaintenanceKind)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {MAINTENANCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {maintenanceKindLabel(k)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Usage at service (${eq.usageMetric === 'MILES' ? 'mi' : 'hr'})`}>
              <input
                type="number"
                min="0"
                value={logUsageStr}
                onChange={(e) => setLogUsageStr(e.target.value)}
                placeholder={String(eq.currentUsage)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Description">
              <input
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder="Oil change + air filter"
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Vendor / mechanic">
              <input
                value={logVendor}
                onChange={(e) => setLogVendor(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Cost ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={logCostStr}
                onChange={(e) => setLogCostStr(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <div className="self-end">
              <button
                type="button"
                onClick={logService}
                className="rounded bg-yge-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-yge-blue-700"
              >
                Log entry
              </button>
            </div>
          </div>
        </div>

        {eq.maintenanceLog.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No maintenance entries yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 rounded border border-gray-200 bg-white">
            {[...eq.maintenanceLog]
              .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
              .map((entry, i) => (
                <li key={i} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="font-medium text-gray-900">
                      {maintenanceKindLabel(entry.kind)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(entry.performedAt).toLocaleDateString()} &middot;{' '}
                      {entry.usageAtService.toLocaleString('en-US')}{' '}
                      {eq.usageMetric === 'MILES' ? 'mi' : 'hr'}
                    </div>
                  </div>
                  <div className="mt-1 text-gray-700">{entry.description}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.performedBy && <>by {entry.performedBy}</>}
                    {entry.costCents !== undefined && (
                      <>
                        {entry.performedBy ? ' \u00b7 ' : ''}
                        {formatUSD(entry.costCents)}
                      </>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section>
        <Field label="Notes">
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
