'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, AppShell } from '../../../components';
import type { Jsa, JsaHazard, JsaTaskType, Job } from '@yge/shared';
import { JSA_TEMPLATES, jsaTaskTypeLabel } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';
import { VoiceButton } from '@/components/voice-button';

const TASK_TYPES: JsaTaskType[] = [
  'EXCAVATION',
  'GRADING',
  'CONCRETE_PLACEMENT',
  'GUARDRAIL',
  'TREE_FELLING',
  'BRUSH_REMOVAL',
  'PRESCRIBED_BURN_PREP',
  'EQUIPMENT_OPERATION',
  'DUMP_TRUCK_HAUL',
  'TRAFFIC_CONTROL',
  'WORK_NEAR_WATER',
  'CONFINED_SPACE',
  'FALL_PROTECTION',
  'HOT_WORK',
  'DEMOLITION',
  'OTHER',
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewJsaPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState('');
  const [workDate, setWorkDate] = useState(todayIso());
  const [startTime, setStartTime] = useState('');
  const [taskType, setTaskType] = useState<JsaTaskType>('EXCAVATION');
  const [taskDescription, setTaskDescription] = useState('');
  const [weather, setWeather] = useState('');
  const [siteConditions, setSiteConditions] = useState('');
  const [preparedByName, setPreparedByName] = useState('');
  const [additionalHazardsText, setAdditionalHazardsText] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${apiBase}/api/jobs`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((j: { jobs: Job[] }) => setJobs(j.jobs ?? []))
      .catch(() => {});
  }, []);

  // Hazards = template + additional free-form (one per line, LOW severity).
  const hazards: JsaHazard[] = useMemo(() => {
    const base = useTemplate ? JSA_TEMPLATES[taskType] ?? [] : [];
    const extras: JsaHazard[] = additionalHazardsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => ({
        description: line,
        controls: [],
        ppe: [],
        severity: 'LOW' as const,
      }));
    return [...base, ...extras];
  }, [useTemplate, taskType, additionalHazardsText]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!jobId) {
      setError('Pick a job.');
      return;
    }
    if (!preparedByName.trim()) {
      setError('Foreman name is required.');
      return;
    }
    if (!taskDescription.trim()) {
      setError('Task description is required.');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      jobId,
      workDate,
      taskType,
      taskDescription: taskDescription.trim(),
      preparedByName: preparedByName.trim(),
      foremanSignedAt: new Date().toISOString(),
      hazards,
      crewSignatures: [],
      photoRefs: [],
    };
    if (startTime) body.startTime = startTime;
    if (weather.trim()) body.weather = weather.trim();
    if (siteConditions.trim()) body.siteConditions = siteConditions.trim();
    if (notes.trim()) body.notes = notes.trim();
    try {
      const res = await postJson<{ jsa: Jsa }>('/api/jsas', body);
      router.push(`/jsas/${res.jsa.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError('Unknown error');
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="mb-6">
          <Link href="/jsas" className="text-sm text-yge-blue-500 hover:underline">
            ← Back to JSAs
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-yge-blue-500">New JSA</h1>
        <p className="mt-2 text-gray-700">
          Pick the task type and the app loads our pre-built hazards for that work. Add any
          site-specific hazards in the box below. Foreman signs by submitting.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Job">
              <select
                required
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Pick a job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.projectName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Task type">
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as JsaTaskType)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {jsaTaskTypeLabel(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                required
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Start time (optional)">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Foreman name">
            <input
              required
              value={preparedByName}
              onChange={(e) => setPreparedByName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Task description">
            <textarea
              required
              rows={3}
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="What's the crew doing today? Where?"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-1">
              <VoiceButton currentValue={taskDescription} onTranscript={setTaskDescription} ariaLabel="Dictate task description" />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weather (optional)">
              <input
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="e.g. sunny, 85°F"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Site conditions (optional)">
              <input
                value={siteConditions}
                onChange={(e) => setSiteConditions(e.target.value)}
                placeholder="e.g. steep slope, traffic, neighbors"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useTemplate}
              onChange={(e) => setUseTemplate(e.target.checked)}
            />
            <span className="font-medium text-gray-700">
              Pre-load hazards from the “{jsaTaskTypeLabel(taskType)}” template
            </span>
          </label>

          {hazards.length > 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Hazards on this JSA ({hazards.length})
              </div>
              <ul className="space-y-1.5 text-xs">
                {hazards.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        h.severity === 'CRITICAL'
                          ? 'bg-red-200 text-red-900'
                          : h.severity === 'HIGH'
                            ? 'bg-amber-200 text-amber-900'
                            : h.severity === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-900'
                              : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {h.severity}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{h.description}</div>
                      {h.controls.length > 0 ? (
                        <div className="text-gray-700">Controls: {h.controls.join(', ')}</div>
                      ) : null}
                      {h.ppe.length > 0 ? (
                        <div className="text-gray-700">PPE: {h.ppe.join(', ')}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field label="Additional hazards (one per line)">
            <textarea
              rows={3}
              value={additionalHazardsText}
              onChange={(e) => setAdditionalHazardsText(e.target.value)}
              placeholder="e.g. Wasp nest near catch basin&#10;Steep cut bank above grade work"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-1">
              <VoiceButton currentValue={additionalHazardsText} onTranscript={setAdditionalHazardsText} ariaLabel="Dictate additional hazards" />
            </div>
          </Field>

          <Field label="Notes (optional)">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-1">
              <VoiceButton currentValue={notes} onTranscript={setNotes} ariaLabel="Dictate notes" />
            </div>
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {saving ? 'Signing…' : 'Sign + submit'}
            </button>
            <Link href="/jsas" className="text-sm text-gray-600 hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </AppShell>
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
