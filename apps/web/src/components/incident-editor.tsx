// Incident editor — OSHA 300/301 entry form.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  incidentClassificationLabel,
  incidentOutcomeLabel,
  incidentStatusLabel,
  type Incident,
  type IncidentClassification,
  type IncidentOutcome,
  type IncidentStatus,
} from '@yge/shared';

const CLASSIFICATIONS: IncidentClassification[] = [
  'INJURY',
  'SKIN_DISORDER',
  'RESPIRATORY',
  'POISONING',
  'HEARING_LOSS',
  'OTHER_ILLNESS',
];
const OUTCOMES: IncidentOutcome[] = [
  'DEATH',
  'DAYS_AWAY',
  'JOB_TRANSFER_OR_RESTRICTION',
  'OTHER_RECORDABLE',
];
const STATUSES: IncidentStatus[] = ['OPEN', 'CLOSED'];

interface FormState {
  caseNumber: string;
  logYear: string;
  incidentDate: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  location: string;
  jobId: string;
  description: string;
  classification: IncidentClassification;
  outcome: IncidentOutcome;
  daysAway: string;
  daysRestricted: string;
  privacyCase: boolean;
  incidentTime: string;
  workStartTime: string;
  taskBeforeIncident: string;
  whatHappened: string;
  injuryDescription: string;
  harmingAgent: string;
  hireDate: string;
  died: boolean;
  dateOfDeath: string;
  physicianName: string;
  facilityName: string;
  facilityAddress: string;
  treatedInER: boolean;
  hospitalizedOvernight: boolean;
  calOshaReported: boolean;
  status: IncidentStatus;
  closedOn: string;
  preparedByName: string;
  preparedByTitle: string;
  preparedOn: string;
  notes: string;
}

function defaults(i?: Incident): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    caseNumber: i?.caseNumber ?? '',
    logYear: String(i?.logYear ?? new Date().getFullYear()),
    incidentDate: i?.incidentDate ?? today,
    employeeId: i?.employeeId ?? '',
    employeeName: i?.employeeName ?? '',
    jobTitle: i?.jobTitle ?? '',
    location: i?.location ?? '',
    jobId: i?.jobId ?? '',
    description: i?.description ?? '',
    classification: i?.classification ?? 'INJURY',
    outcome: i?.outcome ?? 'OTHER_RECORDABLE',
    daysAway: String(i?.daysAway ?? 0),
    daysRestricted: String(i?.daysRestricted ?? 0),
    privacyCase: i?.privacyCase ?? false,
    incidentTime: i?.incidentTime ?? '',
    workStartTime: i?.workStartTime ?? '',
    taskBeforeIncident: i?.taskBeforeIncident ?? '',
    whatHappened: i?.whatHappened ?? '',
    injuryDescription: i?.injuryDescription ?? '',
    harmingAgent: i?.harmingAgent ?? '',
    hireDate: i?.hireDate ?? '',
    died: i?.died ?? false,
    dateOfDeath: i?.dateOfDeath ?? '',
    physicianName: i?.physicianName ?? '',
    facilityName: i?.facilityName ?? '',
    facilityAddress: i?.facilityAddress ?? '',
    treatedInER: i?.treatedInER ?? false,
    hospitalizedOvernight: i?.hospitalizedOvernight ?? false,
    calOshaReported: i?.calOshaReported ?? false,
    status: i?.status ?? 'OPEN',
    closedOn: i?.closedOn ?? '',
    preparedByName: i?.preparedByName ?? 'Ryan D. Young',
    preparedByTitle: i?.preparedByTitle ?? 'Vice President / Safety Director',
    preparedOn: i?.preparedOn ?? today,
    notes: i?.notes ?? '',
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function IncidentEditor({
  mode,
  incident,
}: {
  mode: 'create' | 'edit';
  incident?: Incident;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(incident));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      caseNumber: form.caseNumber.trim(),
      logYear: Number(form.logYear),
      incidentDate: form.incidentDate,
      employeeId: trim(form.employeeId),
      employeeName: form.employeeName.trim(),
      jobTitle: trim(form.jobTitle),
      location: form.location.trim(),
      jobId: trim(form.jobId),
      description: form.description.trim(),
      classification: form.classification,
      outcome: form.outcome,
      daysAway: Number(form.daysAway || 0),
      daysRestricted: Number(form.daysRestricted || 0),
      privacyCase: form.privacyCase,
      incidentTime: trim(form.incidentTime),
      workStartTime: trim(form.workStartTime),
      taskBeforeIncident: trim(form.taskBeforeIncident),
      whatHappened: trim(form.whatHappened),
      injuryDescription: trim(form.injuryDescription),
      harmingAgent: trim(form.harmingAgent),
      hireDate: trim(form.hireDate),
      died: form.died,
      dateOfDeath: trim(form.dateOfDeath),
      physicianName: trim(form.physicianName),
      facilityName: trim(form.facilityName),
      facilityAddress: trim(form.facilityAddress),
      treatedInER: form.treatedInER,
      hospitalizedOvernight: form.hospitalizedOvernight,
      calOshaReported: form.calOshaReported,
      status: form.status,
      closedOn: trim(form.closedOn),
      preparedByName: trim(form.preparedByName),
      preparedByTitle: trim(form.preparedByTitle),
      preparedOn: trim(form.preparedOn),
      notes: trim(form.notes),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/incidents`
          : `${apiBaseUrl()}/api/incidents/${incident!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { incident: Incident };
      if (mode === 'create') {
        router.push(`/incidents/${json.incident.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {form.died && !form.calOshaReported && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>URGENT:</strong> Death must be reported to Cal/OSHA within 8
          hours per Labor Code §6409.1. Mark <em>Cal/OSHA reported</em> below
          once the call is made.
        </div>
      )}

      <Section title="Case identification">
        <Field label="Case #" required>
          <input
            className={inputCls}
            value={form.caseNumber}
            onChange={(e) => setField('caseNumber', e.target.value)}
            placeholder="2026-001"
            required
          />
        </Field>
        <Field label="Log year" required>
          <input
            type="number"
            className={inputCls}
            value={form.logYear}
            onChange={(e) => setField('logYear', e.target.value)}
            required
          />
        </Field>
        <Field label="Incident date" required>
          <input
            type="date"
            className={inputCls}
            value={form.incidentDate}
            onChange={(e) => setField('incidentDate', e.target.value)}
            required
          />
        </Field>
        <Field label="Time of incident (HH:MM)">
          <input
            className={inputCls}
            value={form.incidentTime}
            onChange={(e) => setField('incidentTime', e.target.value)}
            placeholder="14:30"
          />
        </Field>
      </Section>

      <Section title="Employee">
        <Field label="Employee name" required>
          <input
            className={inputCls}
            value={form.employeeName}
            onChange={(e) => setField('employeeName', e.target.value)}
            required
          />
        </Field>
        <Field label="Employee ID">
          <input
            className={inputCls}
            value={form.employeeId}
            onChange={(e) => setField('employeeId', e.target.value)}
            placeholder="emp-xxxxxxxx"
          />
        </Field>
        <Field label="Job title">
          <input
            className={inputCls}
            value={form.jobTitle}
            onChange={(e) => setField('jobTitle', e.target.value)}
          />
        </Field>
        <Field label="Hire date">
          <input
            type="date"
            className={inputCls}
            value={form.hireDate}
            onChange={(e) => setField('hireDate', e.target.value)}
          />
        </Field>
        <Field label="Privacy case">
          <Checkbox
            checked={form.privacyCase}
            onChange={(b) => setField('privacyCase', b)}
            label='Print "Privacy Case" instead of name on Form 300'
          />
        </Field>
        <Field label="Time work started (HH:MM)">
          <input
            className={inputCls}
            value={form.workStartTime}
            onChange={(e) => setField('workStartTime', e.target.value)}
            placeholder="07:00"
          />
        </Field>
      </Section>

      <Section title="Where + what (Form 300 description)">
        <Field label="Location" required>
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="Sulphur Springs Rd, Sta. 12+50"
            required
          />
        </Field>
        <Field label="Job ID">
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder="job-YYYY-MM-DD-..."
          />
        </Field>
        <Field label="Description (injury, body parts, agent)" required full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Strained right shoulder while lifting form panel."
            required
          />
        </Field>
      </Section>

      <Section title="Classification + outcome">
        <Field label="Classification" required>
          <select
            className={inputCls}
            value={form.classification}
            onChange={(e) =>
              setField('classification', e.target.value as IncidentClassification)
            }
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {incidentClassificationLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Outcome" required>
          <select
            className={inputCls}
            value={form.outcome}
            onChange={(e) => setField('outcome', e.target.value as IncidentOutcome)}
          >
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {incidentOutcomeLabel(o)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Days away from work">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.daysAway}
            onChange={(e) => setField('daysAway', e.target.value)}
          />
        </Field>
        <Field label="Days of restricted duty">
          <input
            type="number"
            min="0"
            className={inputCls}
            value={form.daysRestricted}
            onChange={(e) => setField('daysRestricted', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Form 301 narrative">
        <Field label="What was the employee doing just before?" full>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={form.taskBeforeIncident}
            onChange={(e) => setField('taskBeforeIncident', e.target.value)}
          />
        </Field>
        <Field label="What happened?" full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={form.whatHappened}
            onChange={(e) => setField('whatHappened', e.target.value)}
          />
        </Field>
        <Field label="Injury / illness description (body parts)" full>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={form.injuryDescription}
            onChange={(e) => setField('injuryDescription', e.target.value)}
          />
        </Field>
        <Field label="Object / substance that harmed the employee">
          <input
            className={inputCls}
            value={form.harmingAgent}
            onChange={(e) => setField('harmingAgent', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Treatment">
        <Field label="Treating physician">
          <input
            className={inputCls}
            value={form.physicianName}
            onChange={(e) => setField('physicianName', e.target.value)}
          />
        </Field>
        <Field label="Facility name">
          <input
            className={inputCls}
            value={form.facilityName}
            onChange={(e) => setField('facilityName', e.target.value)}
          />
        </Field>
        <Field label="Facility address" full>
          <input
            className={inputCls}
            value={form.facilityAddress}
            onChange={(e) => setField('facilityAddress', e.target.value)}
          />
        </Field>
        <Field label="Treated in ER">
          <Checkbox
            checked={form.treatedInER}
            onChange={(b) => setField('treatedInER', b)}
            label="Employee was treated in an emergency room"
          />
        </Field>
        <Field label="Hospitalized overnight">
          <Checkbox
            checked={form.hospitalizedOvernight}
            onChange={(b) => setField('hospitalizedOvernight', b)}
            label="Employee was admitted overnight"
          />
        </Field>
      </Section>

      <Section title="Severity flags">
        <Field label="Death">
          <Checkbox
            checked={form.died}
            onChange={(b) => setField('died', b)}
            label="Employee died from this incident"
          />
        </Field>
        <Field label="Date of death">
          <input
            type="date"
            className={inputCls}
            value={form.dateOfDeath}
            onChange={(e) => setField('dateOfDeath', e.target.value)}
          />
        </Field>
        <Field label="Reported to Cal/OSHA">
          <Checkbox
            checked={form.calOshaReported}
            onChange={(b) => setField('calOshaReported', b)}
            label="8-hour Cal/OSHA call has been made (LC §6409.1)"
          />
        </Field>
      </Section>

      <Section title="Status">
        <Field label="Case status">
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as IncidentStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {incidentStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Closed on">
          <input
            type="date"
            className={inputCls}
            value={form.closedOn}
            onChange={(e) => setField('closedOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Form 301 prepared by">
        <Field label="Name">
          <input
            className={inputCls}
            value={form.preparedByName}
            onChange={(e) => setField('preparedByName', e.target.value)}
          />
        </Field>
        <Field label="Title">
          <input
            className={inputCls}
            value={form.preparedByTitle}
            onChange={(e) => setField('preparedByTitle', e.target.value)}
          />
        </Field>
        <Field label="Prepared on">
          <input
            type="date"
            className={inputCls}
            value={form.preparedOn}
            onChange={(e) => setField('preparedOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" full>
          <textarea
            className={`${inputCls} min-h-[80px]`}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-yge-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Log incident' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-yge-blue-500 focus:ring-yge-blue-500"
      />
      {label}
    </label>
  );
}
