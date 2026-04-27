// Toolbox talk editor.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  toolboxTalkStatusLabel,
  type ToolboxTalk,
  type ToolboxTalkAttendee,
  type ToolboxTalkStatus,
} from '@yge/shared';

const STATUSES: ToolboxTalkStatus[] = ['DRAFT', 'HELD', 'SUBMITTED'];

interface FormState {
  heldOn: string;
  jobId: string;
  location: string;
  topic: string;
  body: string;
  leaderName: string;
  leaderTitle: string;
  status: ToolboxTalkStatus;
  submittedOn: string;
  notes: string;
  attendees: ToolboxTalkAttendee[];
}

function defaults(t?: ToolboxTalk): FormState {
  return {
    heldOn: t?.heldOn ?? new Date().toISOString().slice(0, 10),
    jobId: t?.jobId ?? '',
    location: t?.location ?? '',
    topic: t?.topic ?? '',
    body: t?.body ?? '',
    leaderName: t?.leaderName ?? 'Ryan D. Young',
    leaderTitle: t?.leaderTitle ?? 'Vice President / Safety Director',
    status: t?.status ?? 'DRAFT',
    submittedOn: t?.submittedOn ?? '',
    notes: t?.notes ?? '',
    attendees: t?.attendees ?? [],
  };
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ToolboxTalkEditor({
  mode,
  talk,
}: {
  mode: 'create' | 'edit';
  talk?: ToolboxTalk;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaults(talk));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function addAttendee() {
    setField('attendees', [
      ...form.attendees,
      { name: '', signed: false },
    ]);
  }

  function updateAttendee(i: number, patch: Partial<ToolboxTalkAttendee>) {
    setField(
      'attendees',
      form.attendees.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );
  }

  function removeAttendee(i: number) {
    setField(
      'attendees',
      form.attendees.filter((_, idx) => idx !== i),
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const trim = (s: string) => (s.trim().length === 0 ? undefined : s.trim());
    const body: Record<string, unknown> = {
      heldOn: form.heldOn,
      jobId: trim(form.jobId),
      location: trim(form.location),
      topic: form.topic.trim(),
      body: trim(form.body),
      leaderName: form.leaderName.trim(),
      leaderTitle: trim(form.leaderTitle),
      status: form.status,
      submittedOn: trim(form.submittedOn),
      notes: trim(form.notes),
      attendees: form.attendees
        .filter((a) => a.name.trim().length > 0)
        .map((a) => ({
          ...a,
          name: a.name.trim(),
          initials: a.initials?.trim() || undefined,
          classification: a.classification?.trim() || undefined,
          employeeId: a.employeeId?.trim() || undefined,
        })),
    };

    try {
      const url =
        mode === 'create'
          ? `${apiBaseUrl()}/api/toolbox-talks`
          : `${apiBaseUrl()}/api/toolbox-talks/${talk!.id}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { talk: ToolboxTalk };
      if (mode === 'create') {
        router.push(`/toolbox-talks/${json.talk.id}`);
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

      <Section title="Meeting">
        <Field label="Held on" required>
          <input
            type="date"
            className={inputCls}
            value={form.heldOn}
            onChange={(e) => setField('heldOn', e.target.value)}
            required
          />
        </Field>
        <Field label="Status">
          <select
            className={inputCls}
            value={form.status}
            onChange={(e) => setField('status', e.target.value as ToolboxTalkStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {toolboxTalkStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Job ID (optional)">
          <input
            className={inputCls}
            value={form.jobId}
            onChange={(e) => setField('jobId', e.target.value)}
            placeholder="job-YYYY-MM-DD-..."
          />
        </Field>
        <Field label="Location">
          <input
            className={inputCls}
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="Yard, jobsite station, etc."
          />
        </Field>
      </Section>

      <Section title="Topic">
        <Field label="Topic" required full>
          <input
            className={inputCls}
            value={form.topic}
            onChange={(e) => setField('topic', e.target.value)}
            placeholder="Trenching safety, heat illness, hand tools..."
            required
          />
        </Field>
        <Field label="Talking points / agenda" full>
          <textarea
            className={`${inputCls} min-h-[120px]`}
            value={form.body}
            onChange={(e) => setField('body', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Leader">
        <Field label="Leader name" required>
          <input
            className={inputCls}
            value={form.leaderName}
            onChange={(e) => setField('leaderName', e.target.value)}
            required
          />
        </Field>
        <Field label="Leader title">
          <input
            className={inputCls}
            value={form.leaderTitle}
            onChange={(e) => setField('leaderTitle', e.target.value)}
          />
        </Field>
      </Section>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Attendees ({form.attendees.length})
          </h2>
          <button
            type="button"
            onClick={addAttendee}
            className="rounded border border-yge-blue-500 px-2 py-1 text-xs text-yge-blue-500 hover:bg-yge-blue-50"
          >
            + Add attendee
          </button>
        </div>
        {form.attendees.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">
            No attendees yet. Add the crew that attended the meeting.
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-1">Name</th>
                <th className="py-1">Classification</th>
                <th className="py-1">Initials</th>
                <th className="py-1">Signed</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.attendees.map((a, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={a.name}
                      onChange={(e) => updateAttendee(i, { name: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={a.classification ?? ''}
                      onChange={(e) =>
                        updateAttendee(i, { classification: e.target.value })
                      }
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className={inputCls}
                      value={a.initials ?? ''}
                      onChange={(e) => updateAttendee(i, { initials: e.target.value })}
                    />
                  </td>
                  <td className="py-1 pr-2 text-center">
                    <input
                      type="checkbox"
                      checked={a.signed}
                      onChange={(e) => updateAttendee(i, { signed: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-yge-blue-500 focus:ring-yge-blue-500"
                    />
                  </td>
                  <td className="py-1 pr-0 text-right">
                    <button
                      type="button"
                      onClick={() => removeAttendee(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Section title="Submission">
        <Field label="Submitted on">
          <input
            type="date"
            className={inputCls}
            value={form.submittedOn}
            onChange={(e) => setField('submittedOn', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Notes (incidents, follow-ups, near-misses)" full>
          <textarea
            className={`${inputCls} min-h-[100px]`}
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
          {saving ? 'Saving…' : mode === 'create' ? 'Create talk' : 'Save changes'}
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
