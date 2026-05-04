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
import { useTranslator } from '../lib/use-translator';
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
  const t = useTranslator();
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
      if (!res.ok) throw new Error(t('eqEditor.errSaveStatus', { status: res.status }));
      const json = (await res.json()) as { equipment: Equipment };
      setEq(json.equipment);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('eqEditor.errFallback'));
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
      if (!res.ok) throw new Error(t('eqEditor.errAssignStatus', { status: res.status }));
      const json = (await res.json()) as { equipment: Equipment };
      setEq(json.equipment);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('eqEditor.errAssignFallback'));
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
      if (!res.ok) throw new Error(t('eqEditor.errReturnStatus', { status: res.status }));
      const json = (await res.json()) as { equipment: Equipment };
      setEq(json.equipment);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('eqEditor.errReturnFallback'));
    } finally {
      setSaving(false);
    }
  }

  async function logService() {
    if (logDescription.trim().length === 0) {
      setError(t('eqEditor.errLogDescription'));
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
      setError(err instanceof Error ? err.message : t('eqEditor.errLogFallback'));
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
            {t('eqEditor.subtitle', { category: equipmentCategoryLabel(eq.category), status: equipmentStatusLabel(eq.status), usage: formatUsage(eq) })}
            {next !== undefined && t('eqEditor.subtitleNext', { usage: next.toLocaleString('en-US'), unit: eq.usageMetric === 'MILES' ? t('eqEditor.unitMi') : t('eqEditor.unitHr') })}
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
          {saving && <span className="text-gray-500">{t('eqEditor.saving')}</span>}
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lvl === 'overdue' && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <strong>{t('eqEditor.overdueLeader')}</strong>{t('eqEditor.overdueBody')}
        </div>
      )}
      {lvl === 'warn' && (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          <strong>{t('eqEditor.warnLeader')}</strong>{t('eqEditor.warnBody')}
        </div>
      )}

      {/* Dispatch */}
      <section>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('eqEditor.dispatchHeader')}</h2>
        {eq.status === 'ASSIGNED' ? (
          <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">
            {t('eqEditor.currentlyOnPrefix')}
            <strong>{assignedJob?.projectName ?? eq.assignedJobId}</strong>
            {assignedOp && (
              <>
                {t('eqEditor.withOperator')}<strong>{fullName(assignedOp)}</strong>
              </>
            )}
            {eq.assignedAt && (
              <span className="text-gray-600">{t('eqEditor.sinceSuffix', { date: new Date(eq.assignedAt).toLocaleDateString() })}</span>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void returnUnit('IN_YARD')}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
              >
                {t('eqEditor.returnYard')}
              </button>
              <button
                type="button"
                onClick={() => void returnUnit('IN_SERVICE')}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
              >
                {t('eqEditor.sendShop')}
              </button>
              <button
                type="button"
                onClick={() => void returnUnit('OUT_FOR_REPAIR')}
                className="rounded border border-orange-300 bg-white px-2 py-1 text-xs text-orange-700 hover:bg-orange-50"
              >
                {t('eqEditor.outRepair')}
              </button>
            </div>
          </div>
        ) : eq.status === 'RETIRED' || eq.status === 'SOLD' ? (
          <p className="text-sm text-gray-500">
            {t('eqEditor.notDispatchable', { status: equipmentStatusLabel(eq.status).toLowerCase() })}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('eqEditor.lblJob')}>
              <select
                value={assignJobId}
                onChange={(e) => setAssignJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {jobs.length === 0 && <option value="">{t('eqEditor.noJobs')}</option>}
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.projectName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('eqEditor.lblOperator')}>
              <select
                value={assignOpId}
                onChange={(e) => setAssignOpId(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">{t('eqEditor.noneOption')}</option>
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
                {t('eqEditor.assignBtn')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Identification */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label={t('eqEditor.lblName')}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('eqEditor.lblCategory')}>
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
        <Field label={t('eqEditor.lblUsageMetric')}>
          <select
            value={eq.usageMetric}
            onChange={(e) =>
              void patch({ usageMetric: e.target.value as EquipmentUsageMetric })
            }
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="MILES">{t('eqEditor.usageMiles')}</option>
            <option value="HOURS">{t('eqEditor.usageHours')}</option>
          </select>
        </Field>
        <Field label={t('eqEditor.lblYear')}>
          <input
            value={yearStr}
            onChange={(e) => setYearStr(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('eqEditor.lblMake')}>
          <input
            value={make}
            onChange={(e) => setMake(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('eqEditor.lblModel')}>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('eqEditor.lblVin')}>
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('eqEditor.lblSerial')}>
          <input
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('eqEditor.lblPlate')}>
          <input
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('eqEditor.lblAssetTag')}>
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
        <Field label={eq.usageMetric === 'MILES' ? t('eqEditor.lblCurrentOdo') : t('eqEditor.lblCurrentHr')}>
          <input
            type="number"
            min="0"
            value={currentUsage}
            onChange={(e) => setCurrentUsage(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={eq.usageMetric === 'MILES' ? t('eqEditor.lblLastServiceMi') : t('eqEditor.lblLastServiceHr')}>
          <input
            type="number"
            min="0"
            value={lastServiceStr}
            onChange={(e) => setLastServiceStr(e.target.value)}
            onBlur={saveBasics}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={eq.usageMetric === 'MILES' ? t('eqEditor.lblIntervalMi') : t('eqEditor.lblIntervalHr')}>
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
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{t('eqEditor.maintHeader')}</h2>

        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('eqEditor.lblLogKind')}>
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
            <Field label={eq.usageMetric === 'MILES' ? t('eqEditor.lblLogUsageMi') : t('eqEditor.lblLogUsageHr')}>
              <input
                type="number"
                min="0"
                value={logUsageStr}
                onChange={(e) => setLogUsageStr(e.target.value)}
                placeholder={String(eq.currentUsage)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('eqEditor.lblLogDescription')}>
              <input
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder={t('eqEditor.phLogDescription')}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('eqEditor.lblLogVendor')}>
              <input
                value={logVendor}
                onChange={(e) => setLogVendor(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label={t('eqEditor.lblLogCost')}>
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
                {t('eqEditor.logEntryBtn')}
              </button>
            </div>
          </div>
        </div>

        {eq.maintenanceLog.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">{t('eqEditor.maintEmpty')}</p>
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
                      {t('eqEditor.entrySubtitle', { date: new Date(entry.performedAt).toLocaleDateString(), usage: entry.usageAtService.toLocaleString('en-US'), unit: eq.usageMetric === 'MILES' ? t('eqEditor.unitMi') : t('eqEditor.unitHr') })}
                    </div>
                  </div>
                  <div className="mt-1 text-gray-700">{entry.description}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.performedBy && <>{t('eqEditor.entryByPrefix')}{entry.performedBy}</>}
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
        <Field label={t('eqEditor.lblNotes')}>
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
