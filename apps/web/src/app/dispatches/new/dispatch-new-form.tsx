'use client';

// Minimal dispatch create form.
//
// Plain English: pick a job, set the date + meet info + scope,
// save as draft or post straight to the foremen. Crew + equipment
// arrays default to empty — fill them in from the detail page in
// a follow-up commit.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DispatchCreate, DispatchStatus } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const inputClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';
const textareaClass = 'w-full rounded border border-gray-300 px-2 py-1.5 text-sm';

export function DispatchNewForm() {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [scheduledFor, setScheduledFor] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [foremanName, setForemanName] = useState('');
  const [foremanPhone, setForemanPhone] = useState('');
  const [meetTime, setMeetTime] = useState('06:00');
  const [meetLocation, setMeetLocation] = useState('YGE yard, Cottonwood');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(status: DispatchStatus): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      if (!jobId.trim()) { setError('Job id is required.'); return; }
      if (!foremanName.trim()) { setError('Foreman name is required.'); return; }
      if (!scopeOfWork.trim()) { setError('Scope of work is required.'); return; }
      const payload: DispatchCreate = {
        jobId: jobId.trim(),
        scheduledFor,
        foremanName: foremanName.trim(),
        foremanPhone: foremanPhone.trim() || undefined,
        meetTime: meetTime.trim() || undefined,
        meetLocation: meetLocation.trim() || undefined,
        scopeOfWork: scopeOfWork.trim(),
        specialInstructions: specialInstructions.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      };
      const res = await fetch(`${apiBaseUrl()}/api/dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Save failed (${res.status}).`);
        return;
      }
      router.push('/dispatches');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</div>
      )}

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job ID (required)">
            <input type="text" value={jobId}
              onChange={(e) => setJobId(e.target.value)} className={inputClass + ' font-mono'}
              placeholder="job-2026-04-..." />
          </Field>
          <Field label="Scheduled for (required)">
            <input type="date" value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Foreman name (required)">
            <input type="text" value={foremanName}
              onChange={(e) => setForemanName(e.target.value)} className={inputClass}
              placeholder="e.g. Mike Johnson" />
          </Field>
          <Field label="Foreman phone">
            <input type="tel" value={foremanPhone}
              onChange={(e) => setForemanPhone(e.target.value)} className={inputClass}
              placeholder="707-555-0100" />
          </Field>
          <Field label="Meet time">
            <input type="text" value={meetTime}
              onChange={(e) => setMeetTime(e.target.value)} className={inputClass}
              placeholder="06:00" />
          </Field>
          <Field label="Meet location">
            <input type="text" value={meetLocation}
              onChange={(e) => setMeetLocation(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <Field label="Scope of work (required)">
          <textarea value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)} rows={5}
            className={textareaClass}
            placeholder="Bullet the day's work. The foreman reads this to the crew at the morning meeting." />
        </Field>
        <div className="mt-3">
          <Field label="Special instructions / safety topics (optional)">
            <textarea value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)} rows={3}
              className={textareaClass}
              placeholder="PPE, hazard zones, traffic control, ramps, anything outside the routine." />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Internal notes (not printed)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className={textareaClass}
              placeholder="Free-form" />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={() => save('DRAFT')}
          className="rounded border border-yge-blue-500 px-4 py-2 text-sm font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50">
          Save as draft
        </button>
        <button type="button" disabled={busy} onClick={() => save('POSTED')}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Post to foremen'}
        </button>
      </div>
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
