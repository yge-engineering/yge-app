'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, AppShell } from '../../../components';
import type { PlanTakeoff } from '@yge/shared';
import { ApiError, postJson } from '@/lib/api';

export default function NewPlanTakeoffPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [planRef, setPlanRef] = useState('');
  const [bidId, setBidId] = useState('');
  const [jobId, setJobId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!planRef.trim()) {
      setError('PDF reference is required (URL or document id).');
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      planRef: planRef.trim(),
    };
    if (bidId.trim()) body.bidId = bidId.trim();
    if (jobId.trim()) body.jobId = jobId.trim();
    if (notes.trim()) body.notes = notes.trim();
    try {
      const res = await postJson<{ takeoff: PlanTakeoff }>('/api/plan-takeoffs', body);
      router.push(`/plan-takeoffs/${res.takeoff.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.message} (${err.status})`);
      else if (err instanceof Error) setError(err.message);
      else setError('Unknown error');
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl p-8">
        <div className="mb-6">
          <Link
            href="/plan-takeoffs"
            className="text-sm text-yge-blue-500 hover:underline"
          >
            ← Back to takeoffs
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-yge-blue-500">New plan takeoff</h1>
        <p className="mt-2 text-gray-700">
          Paste a PDF URL (a public link or an uploaded document) and we&apos;ll open it
          in the measurement editor. You can link it to a bid or a job now or later.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Name">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sulphur Springs — Plan Set Rev 2"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="PDF URL or document reference">
            <input
              required
              value={planRef}
              onChange={(e) => setPlanRef(e.target.value)}
              placeholder="https://… or doc-xxxxxxxx"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Any URL the browser can fetch (public PDF, signed Supabase URL, etc.).
              We&apos;ll wire this into your Documents vault in a follow-up.
            </span>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Bid id (optional)">
              <input
                value={bidId}
                onChange={(e) => setBidId(e.target.value)}
                placeholder="e.g. bid-…"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </Field>
            <Field label="Job id (optional)">
              <input
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="e.g. job-…"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create takeoff'}
            </button>
            <Link
              href="/plan-takeoffs"
              className="text-sm text-gray-600 hover:underline"
            >
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
