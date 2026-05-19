'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  PunchItemCreate,
  PunchItemSeverity,
  PunchItemStatus,
} from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const SEVERITIES: PunchItemSeverity[] = ['SAFETY', 'MAJOR', 'MINOR'];
const STATUSES: PunchItemStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED', 'DISPUTED', 'WAIVED'];

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';
const selectClass = 'rounded border border-gray-300 px-2 py-1.5 text-sm bg-white w-full';
const textareaClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';

export function PunchItemNewForm() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [identifiedOn, setIdentifiedOn] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<PunchItemSeverity>('MINOR');
  const [status, setStatus] = useState<PunchItemStatus>('OPEN');
  const [responsibleParty, setResponsibleParty] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (!jobId.trim()) { setError('Job id is required.'); return; }
      if (!location.trim()) { setError('Location is required.'); return; }
      if (!description.trim()) { setError('Description is required.'); return; }
      const payload: PunchItemCreate = {
        jobId: jobId.trim(),
        identifiedOn,
        location: location.trim(),
        description: description.trim(),
        severity,
        status,
        responsibleParty: responsibleParty.trim() || undefined,
        dueOn: dueOn || undefined,
        notes: notes.trim() || undefined,
      };
      const res = await fetch(`${apiBaseUrl()}/api/punch-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status}).`);
        return;
      }
      router.push('/punch-items');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</div>}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job ID (required)">
            <input type="text" value={jobId} onChange={(e) => setJobId(e.target.value)}
              className={inputClass + ' font-mono'} placeholder="job-2026-04-..." />
          </Field>
          <Field label="Identified on">
            <input type="date" value={identifiedOn}
              onChange={(e) => setIdentifiedOn(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Location (required)">
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              className={inputClass} placeholder='Sta. 12+50 LT, catch basin #3' />
          </Field>
          <Field label="Severity">
            <select value={severity}
              onChange={(e) => setSeverity(e.target.value as PunchItemSeverity)}
              className={selectClass}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Responsible party">
            <input type="text" value={responsibleParty}
              onChange={(e) => setResponsibleParty(e.target.value)} className={inputClass}
              placeholder="In-house crew, ABC Concrete Co, ..." />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as PunchItemStatus)}
              className={selectClass}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Due on (optional)">
            <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)}
              className={inputClass} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Description (required)">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={4} className={textareaClass}
              placeholder="What's wrong, what needs fixing, what the agency flagged." />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes (optional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} className={textareaClass} />
          </Field>
        </div>
      </section>

      <button type="button" disabled={busy} onClick={save}
        className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
        {busy ? 'Saving…' : 'Save punch item'}
      </button>
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
