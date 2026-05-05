'use client';

// Modal editor for job-level metadata: project name, type, contract
// type, agency, location, bid due date, engineers' estimate, pursuit
// owner, notes. Sits alongside the existing JobStatusEditor on the
// detail page. PATCHes /api/jobs/:id and refreshes.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Job,
  JobContractType,
  PtoEProjectType,
} from '@yge/shared';

const PROJECT_TYPES: PtoEProjectType[] = [
  'ROAD_RECONSTRUCTION',
  'DRAINAGE',
  'BRIDGE',
  'GRADING',
  'FIRE_FUEL_REDUCTION',
  'OTHER',
];
const CONTRACT_TYPES: JobContractType[] = [
  'PUBLIC_WORKS',
  'PRIVATE',
  'TASK_ORDER',
  'NEGOTIATED',
  'OTHER',
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Props {
  job: Job;
}

export function JobInfoEditor({ job }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        Edit job info
      </button>
      {open && (
        <Modal
          job={job}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Modal({
  job,
  onClose,
  onSaved,
}: {
  job: Job;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projectName, setProjectName] = useState(job.projectName);
  const [projectType, setProjectType] = useState<PtoEProjectType>(job.projectType);
  const [contractType, setContractType] = useState<JobContractType>(job.contractType);
  const [ownerAgency, setOwnerAgency] = useState(job.ownerAgency ?? '');
  const [location, setLocation] = useState(job.location ?? '');
  const [bidDueDate, setBidDueDate] = useState(job.bidDueDate ?? '');
  const [engineersEstimateDollars, setEngineersEstimateDollars] = useState(
    job.engineersEstimateCents !== undefined
      ? (job.engineersEstimateCents / 100).toFixed(2)
      : '',
  );
  const [pursuitOwner, setPursuitOwner] = useState(job.pursuitOwner ?? '');
  const [notes, setNotes] = useState(job.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const ee = engineersEstimateDollars.trim();
    const eeCents = ee ? Math.round(Number(ee.replace(/[$,]/g, '')) * 100) : undefined;
    const body: Record<string, unknown> = {
      projectName: projectName.trim(),
      projectType,
      contractType,
    };
    body.ownerAgency = ownerAgency.trim() || undefined;
    body.location = location.trim() || undefined;
    body.bidDueDate = bidDueDate.trim() || undefined;
    body.engineersEstimateCents = eeCents !== undefined && Number.isFinite(eeCents) && eeCents >= 0 ? eeCents : undefined;
    body.pursuitOwner = pursuitOwner.trim() || undefined;
    body.notes = notes.trim() || undefined;
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Save failed (${res.status}): ${text.slice(0, 120)}`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Edit job info</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Project name</span>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Project type</span>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as PtoEProjectType)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Contract type</span>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as JobContractType)}
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Owner agency / client</span>
            <input
              value={ownerAgency}
              onChange={(e) => setOwnerAgency(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="CAL FIRE / State of California"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Soquel Demonstration State Forest"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Bid due date</span>
              <input
                type="date"
                value={bidDueDate}
                onChange={(e) => setBidDueDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Engineer's estimate ($)</span>
              <input
                type="number"
                step="0.01"
                value={engineersEstimateDollars}
                onChange={(e) => setEngineersEstimateDollars(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="320000"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Pursuit owner</span>
            <input
              value={pursuitOwner}
              onChange={(e) => setPursuitOwner(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ryan / Brook"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
